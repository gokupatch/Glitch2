const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const expressBasicAuth = require('express-basic-auth');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and serving static files
app.use(express.json());
app.use(express.static('public'));

// Enable trust proxy for reverse proxy setups
app.set('trust proxy', 1);

// Basic authentication for protected routes
const requireAuth = expressBasicAuth({
  users: { admin: process.env.ADMIN_PASSWORD }, // Load credentials from .env
  challenge: true,
  unauthorizedResponse: 'Unauthorized',
});

// Rate limiter for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many upload attempts. Please try again later.',
});

// Multer setup for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = file.fieldname; // "original" or "watermarked"
    const uploadDir = uploadType === 'watermarked' ? 'uploads/watermarked/' : 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Create directories if needed
    }
    cb(null, uploadDir); // Set the destination directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Save files with unique names
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Serve the upload page
app.get('/upload', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/upload.html')); // Serve the HTML upload page
});

// Handle image uploads (support multiple files for each type)
app.post('/upload', uploadLimiter, upload.fields([
  { name: 'original', maxCount: 10 }, // Allow up to 10 original files
  { name: 'watermarked', maxCount: 10 }, // Allow up to 10 watermarked files
]), (req, res) => {
  try {
    const originalFiles = req.files.original || [];
    const watermarkedFiles = req.files.watermarked || [];

    if (originalFiles.length === 0 || watermarkedFiles.length === 0) {
      return res.status(400).json({ message: 'Both original and watermarked files are required.' });
    }

    const uploadedFiles = {
      originals: originalFiles.map(file => `/uploads/${file.filename}`),
      watermarked: watermarkedFiles.map(file => `/uploads/watermarked/${file.filename}`),
    };

    res.json({
      message: 'Files uploaded successfully!',
      files: uploadedFiles,
    });
  } catch (error) {
    res.status(500).json({ message: 'File upload failed.', error: error.message });
  }
});

// Serve only watermarked images for the gallery
app.get('/images', (req, res) => {
  const watermarkedDir = 'uploads/watermarked/';
  fs.readdir(watermarkedDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to load images.' });
    }

    // Filter out non-image files and return valid URLs
    const validImages = files.filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file));
    const images = validImages.map((file) => `/uploads/watermarked/${file}`);
    res.json(images);
  });
});

// Handle purchase completion and email original images
app.post('/complete-purchase', async (req, res) => {
  const { email, basket } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const attachments = basket.map((watermarkedPath) => {
      const originalPath = watermarkedPath.replace('/watermarked/', '/'); // Map to original file
      return {
        filename: path.basename(originalPath),
        path: path.join(__dirname, originalPath),
      };
    });

    await transporter.sendMail({
      from: `"Your Gallery" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Purchased Images',
      text: 'Thank you for your purchase! Attached are your original images.',
      attachments,
    });

    res.json({ message: 'Images emailed successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send email.', error: error.message });
  }
});

// Serve uploaded images publicly
app.use('/uploads', express.static('uploads'));

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));