// npm i express dotenv cors cookie-parser bcrypt jsonwebtoken mongoose cloudinary puppeteer
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import puppeteer from 'puppeteer';
import { load } from 'cheerio';
import fs from 'fs';
import JSZip from "jszip";
import pkg from 'file-saver';
const { saveAs } = pkg;
const config = (app, port, dburl = null) => {
    //> express
    app.listen(port, async () => {
        console.log("Server is running on http://localhost:" + port);
        if (dburl) {
            connectDB(dburl);
        } else {
            console.log("No database url provided. So not connected to the database")
        }
    })

    //> cors
    app.use(cors({
        origin: "http://localhost:3000",  // Frontend URL
        methods: ["GET", "POST"],
        credentials: true,  // Allow cookies to be sent
    }));

    //> dotenv, cookieParser, bodyParser, json
    dotenv.config();
    app.use(cookieParser());  // puts the cookie in the request object
    app.use(express.urlencoded({ extended: true }));  // if the form data is in urlencoded format, use this
    app.use(express.json()); // used for json parsing that is used for the body of the request to be displayed in json format

    //> cloudinary
    // cloudinary.config({
    //     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    //     api_key: process.env.CLOUDINARY_API_KEY,
    //     api_secret: process.env.CLOUDINARY_API_SECRET,
    // });

}

async function connectDB(url) {
    try {
        if (mongoose.connection.readyState == 1) {
            console.log("Already connected to the database")
        }
        else {
            await mongoose.connect(process.env.DATABASE_URI || url)
            console.log("Database", mongoose.connection.name, "from the cluster", mongoose.connection.host, mongoose.connection.readyState == 1 ? "connected" : mongoose.connection.readyState == 2 ? "connecting" : "disconnected", "on port:", mongoose.connection.port, "with models", mongoose.connection.models)
        }
    } catch (e) {
        console.log("DATABASE ERROR -------->\n\t", e.message)
        process.exit(1);
    }
    return mongoose.connection
}



const getResponse = async (url, format) => {
    try {
        const response = await fetch(url, {
            // "headers": {
            //     "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            //     "accept-language": "en-US,en;q=0.6",
            //     "cache-control": "no-cache",
            //     "pragma": "no-cache",
            //     "priority": "u=1, i",
            //     "sec-ch-ua": "\"Brave\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
            //     "sec-ch-ua-mobile": "?0",
            //     "sec-ch-ua-platform": "\"Windows\"",
            //     "sec-fetch-dest": "image",
            //     "sec-fetch-mode": "no-cors",
            //     "sec-fetch-site": "same-site",
            //     "sec-gpc": "1"
            // },
            // "referrer": "https://www.freepik.com/",
            // "referrerPolicy": "no-referrer-when-downgrade",
            // "body": null,
            // "method": "GET",
            // "mode": "cors",
            // "credentials": "include"
        });

        if (format == "text" || format == "html") {
            const text = await response.text()
            return text
        }
        if (format == "arraybuffer") {
            const buffer = await response.arrayBuffer()
            return buffer
        }

        return response;
    }
    catch (e) {
        console.log(e)
    }
}



/**
 * Makes a GET request to the specified URL and returns the response using puppeteer.
 * @param {string} url The URL to make the request to.
 * @returns {Promise<string>} The response content.
 * @throws {Error} If the request fails.
 */
const getHTMLPuppeteer = async (url, scroll = false, headless = false) => {
    try {
        const browser = await puppeteer.launch({
            headless,
            monitor: true,
            defaultViewport: false,
            userDataDir: "./tmp"
        })
        const page = await browser.newPage()
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        );
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 })
        if (scroll) {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100; // Number of pixels to scroll each time
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 10); // Delay in milliseconds
                });
            })
        }
        const response = await page.content()
        await browser.close()
        // console.log("Response:", response)
        return response
    }
    catch (e) {
        console.log("Error from getResponsePuppeteer -->", e)
    }
}


const checkNetworkActivity = async (url = null, page = null, resourceTypes = ["xhr", "fetch", "image", "media", "document"], requestExtensions = [], scroll = false, outputFile = "network_activity.json") => {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            monitor: true,
            defaultViewport: null,
            userDataDir: "./tmp",
        });

        // If no page is passed, create a new one
        // if (!page) {
        const page = await browser.newPage();
        // }
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        );
        console.log(url)
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        let apiCalls = [];

        // Listen for all network requests
        await page.setRequestInterception(true);
        page.on('request', request => {
            const resourceType = request.resourceType();
            const requestUrl = request.url();

            if (resourceType && resourceTypes.includes(resourceType)) {
                if (requestExtensions.length === 0 || requestExtensions.some(ext => requestUrl.endsWith(ext))) {
                    apiCalls.push({
                        url: requestUrl,
                        method: request.method(),
                        type: resourceType,
                        headers: request.headers(),
                        body: request.postData(),
                    });
                }
            }
        });
        // page.on("requestfinished", request => {
        //     const resourceType = request.resourceType();
        //     const requestUrl = request.url();

        //     if (resourceTypes.includes(resourceType)) {
        //         if (requestExtensions.length === 0 || requestExtensions.some(ext => requestUrl.endsWith(ext))) {
        //             apiCalls.push({
        //                 url: requestUrl,
        //                 method: request.method(),
        //                 type: resourceType,
        //                 headers: request.headers(),
        //                 body: request.postData(),
        //             });
        //         }
        //     }
        // });
        // Go to the URL and wait for network activity to settle

        if (scroll) {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100; // Number of pixels to scroll each time
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 10); // Delay in milliseconds
                });
            })
        }
        console.log("Number of API calls made by the webpage:", apiCalls.length);

        fs.writeFileSync(outputFile, JSON.stringify(apiCalls, null, 2));

        await browser.close();
        return apiCalls;
    } catch (e) {
        console.error("ERROR FROM checkNetworkActivity ------>\n\t", e.message);
    }
};
// async function main() {
//     // const browser = await puppeteer.launch({
//     //     headless: false,
//     //     // args: ['--proxy-server=47.251.122.81:8888'],
//     //     monitor: true,
//     //     defaultViewport: false,
//     //     userDataDir: "./tmp"
//     // })
//     // const page = await browser.newPage()
//     try {
//         // await browser.close();  // Normal way

//         const apiCalls = await checkNetworkActivity("http://www.unsplash.com", null, ["image"],);
//         apiCalls.map((el) => {
//             console.log(el.url)
//         })
//         process.exit(1);        // Hard exit
//     } catch (e) {
//         console.log("shit ----------->\n", e.message)
//     }

// }
// main();
// getHTMLPuppeteer("https://unsplash.com/")


const downloadImagesAsZip = async (imageUrls) => {
    const zip = new JSZip();
    zip.file("Hello.txt", "Hello World\n")
    const archive = await zip.generateAsync({ type: "blob" })
    return archive
    // await Promise.all(imagePromises); // Wait for all images to be fetched

    // Generate and trigger download
    // zip.generateAsync({ type: "blob" }).then((zipFile) => {
    //     saveAs(zipFile, "images.zip"); // Save as images.zip
    // });
};






function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (err) {
        return false;
    }
}

export default { connectDB, config, getHTMLPuppeteer, checkNetworkActivity, getResponse, isValidURL, downloadImagesAsZip };