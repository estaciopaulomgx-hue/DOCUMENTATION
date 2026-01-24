const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// <-- PALITAN DITO ANG PATH SA IMG FOLDER MO -->
const IMAGE_FOLDER = 'C:/Users/USER/Desktop/DOCLOGIN/PICTURES';

app.use(express.static('public'));
app.use(fileUpload());

// Get list of images
app.get('/images', (req, res) => {
    fs.readdir(IMAGE_FOLDER, (err, files) => {
        if (err) return res.status(500).send('Error reading folder');

        const images = files
            .filter(f => /\.(jpe?g|png|gif)$/i.test(f))
            .map(f => ({
                id: f.replace(/\.[^/.]+$/, ''),
                date: fs.statSync(path.join(IMAGE_FOLDER, f)).mtime.toISOString().split('T')[0],
                image: `/images/${f}`
            }));

        res.json(images);
    });
});

// Upload image
app.post('/upload', (req, res) => {
    if (!req.files || !req.files.file) return res.status(400).send('No file uploaded');

    const file = req.files.file;
    const savePath = path.join(IMAGE_FOLDER, file.name);

    file.mv(savePath, err => {
        if (err) return res.status(500).send('Failed to save image');
        res.json({ success: true, filename: file.name });
    });
});

// Serve images folder
app.use('/images', express.static(IMAGE_FOLDER));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
