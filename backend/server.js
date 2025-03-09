// npm i express dotenv cors cookie-parser bcrypt jsonwebtoken mongoose cloudinary 
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import victor from './victor.js';
import * as cheerio from 'cheerio';
import { load } from 'cheerio';
import { exec, spawn } from "child_process";

const app = express();
const port = process.env.PORT || 7000;
const dburl = process.env.DATABASE_URI || "mongodb+srv://priyeshkjace101mongo:ep9qvqEWVQIOdcTH@cluster0.1z68r.mongodb.net/scraper";

victor.config(app, port);


//> routes
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Hello, world!"
    });
})
// function isValidURL(url) {
//     try {
//         new URL(url);
//         return true;
//     } catch (err) {
//         return false;
//     }
// }

// async function isImage(url) {
//     try {
//         const response = await fetch(url, { method: 'HEAD' });
//         const contentType = response.headers.get('content-type');
//         return contentType.startsWith('image/');
//     } catch (error) {
//         console.error('Error from isImage -->', error.message);
//         return false;
//     }
// }

app.post("/fetchHTMLElements", async (req, res) => {
    const url = req.body;
    console.log(url)
    console.log(mongoose.connection.readyState)
    // await victor.fetchHtmlElements(req, res);
    const elements = {
        images: [],
        videos: [],
        audios: [],
        tables: []
    };
    const html = await victor.getHTMLPuppeteer(url.url, true);
    const images = cheerio.load(html)("img");
    const videos = cheerio.load(html)("video");
    const audios = cheerio.load(html)("audio");
    const tables = cheerio.load(html)("table");
    // images.each((i, el) => {
    //     console.log(el.attr("src"));
    // });
    console.log("Total images found:", images.length)
    images.map((i, el) => {
        if (el.attribs.src) {

            // if (el.attribs.src.includes("http://") || el.attribs.src.includes("https://")) {
            elements.images.push(el.attribs.src.trim());
            // }
        }

    });
    console.log("Total tables found:", tables.length)
    // tables.map((i, el) => {

    //     elements.tables.push(el);
    //     // console.log(el.attribs.src)
    // });
    // console.log(images)
    // elements.images = images.map((i, el) => el.attribs.src);
    // elements.videos = videos.map((i, el) => el.attribs.src);
    // elements.audios = audios.map((i, el) => el.attribs.src);
    // elements.tables = tables.map((i, el) => el.attribs.src);
    console.log(elements)
    res.json({ elements });
})


app.post("/fetchNetworkElements", async (req, res) => {
    try {
        const url = req.body;
        const elements = {
            images: [],
            videos: [],
            audios: [],
            tables: []
        };
        console.log(url)
        const images = await victor.checkNetworkActivity(url.url, null, ["image"], [], true);
        images.map((el) => {
            // if (el.url.includes("http://") || el.url.includes("https://")) {
            elements.images.push(el.url.trim())
            // console.log(el.url)
            // }
        })
        res.json({ elements });

    }
    catch (e) {
        console.log("ERROR FROM fetchNetworkElements ---->", e.message)
    }
})

app.post("/get-formats", (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "YouTube URL is required" });
    }

    const command = `yt-dlp -F "${url}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr || error.message });
        }
        return res.json({ formats: stdout });
    });
});



app.post("/download", (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "No URL provided" });
    }

    console.log("WE GOT THE REQUEST TO DOWNLOAD:", url);

    // Use spawn for proper streaming
    const process = spawn("yt-dlp", ["-o", "-", url]);

    res.setHeader("Content-Disposition", "attachment; filename=video.mp4");
    res.setHeader("Content-Type", "video/mp4");

    process.stdout.pipe(res);

    process.stderr.on("data", (data) => {
        console.log(`${data}`);
    });

    process.on("error", (err) => {
        console.error("Process error:", err);
        res.status(500).json({ error: "Download failed" });
    });

    process.on("close", (code) => {
        if (code !== 0) {
            console.error(`yt-dlp exited with code ${code}`);
            res.status(500).json({ error: "Download process failed" });
        }
    });
});


app.post("/downloadzip", (req, res) => {
    res.send(victor.downloadImagesAsZip());

})