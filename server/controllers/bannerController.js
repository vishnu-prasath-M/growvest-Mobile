const fs = require('fs');
const path = require('path');
const AdBanner = require('../models/AdBanner');

const DEFAULT_BANNERS = [
  {
    title: 'Blushberry Beauty Parlour',
    imageUrl: '/banners/ad-banner-1.png',
    linkUrl: '',
    width: 1024,
    height: 409,
    aspectRatio: 2.50,
    order: 1,
    isActive: true,
  },
  {
    title: 'SeyoN UPVC',
    imageUrl: '/banners/ad-banner-2.png',
    linkUrl: '',
    width: 1024,
    height: 409,
    aspectRatio: 2.50,
    order: 2,
    isActive: true,
  },
  {
    title: 'ABi Restro Cafe Food Truck',
    imageUrl: '/banners/ad-banner-3.png',
    linkUrl: '',
    width: 1024,
    height: 409,
    aspectRatio: 2.50,
    order: 3,
    isActive: true,
  },
];

// Helper to seed initial banners if none exist
async function seedDefaultBannersIfEmpty() {
  try {
    const count = await AdBanner.countDocuments();
    if (count === 0) {
      await AdBanner.insertMany(DEFAULT_BANNERS);
      console.log('[AdBanner] Seeded 3 default ad banners.');
    }
  } catch (err) {
    console.error('[AdBanner] Seed error:', err.message);
  }
}

// 1. PUBLIC: Get active banners for mobile app
exports.getActiveBanners = async (req, res) => {
  try {
    await seedDefaultBannersIfEmpty();
    const banners = await AdBanner.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.status(200).json({ success: true, count: banners.length, banners });
  } catch (error) {
    console.error('[AdBanner] Get active banners error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch banners', error: error.message });
  }
};

// 2. ADMIN: Get all banners (including inactive)
exports.getAllBanners = async (req, res) => {
  try {
    await seedDefaultBannersIfEmpty();
    const banners = await AdBanner.find().sort({ order: 1, createdAt: 1 });
    res.status(200).json({ success: true, count: banners.length, banners });
  } catch (error) {
    console.error('[AdBanner] Get all banners error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch all banners', error: error.message });
  }
};

// 3. ADMIN: Create new banner
exports.createBanner = async (req, res) => {
  try {
    const { title, imageUrl, base64Data, linkUrl, width, height, order, isActive } = req.body;

    if (!title || (!imageUrl && !base64Data)) {
      return res.status(400).json({ success: false, message: 'Banner title and image are required.' });
    }

    let finalImageUrl = (imageUrl || '').trim();

    // If base64 uploaded, save to public/banners directory
    if (base64Data) {
      const bannersDir = path.join(__dirname, '../public/banners');
      if (!fs.existsSync(bannersDir)) {
        fs.mkdirSync(bannersDir, { recursive: true });
      }

      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `banner-${Date.now()}-${Math.round(Math.random() * 1e4)}.png`;
      const filePath = path.join(bannersDir, filename);

      fs.writeFileSync(filePath, buffer);
      finalImageUrl = `/banners/${filename}`;
    }

    const imgWidth = Number(width) || 1024;
    const imgHeight = Number(height) || 409;
    const calculatedRatio = Number((imgWidth / imgHeight).toFixed(2)) || 2.50;

    const bannerCount = await AdBanner.countDocuments();
    const bannerOrder = typeof order === 'number' ? order : bannerCount + 1;

    const newBanner = await AdBanner.create({
      title: title.trim(),
      imageUrl: finalImageUrl,
      linkUrl: (linkUrl || '').trim(),
      width: imgWidth,
      height: imgHeight,
      aspectRatio: calculatedRatio,
      order: bannerOrder,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user?._id,
    });

    res.status(201).json({
      success: true,
      message: 'Ad banner created successfully!',
      banner: newBanner,
    });
  } catch (error) {
    console.error('[AdBanner] Create banner error:', error);
    res.status(500).json({ success: false, message: 'Failed to create banner', error: error.message });
  }
};

// 4. ADMIN: Update banner
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, imageUrl, base64Data, linkUrl, width, height, order, isActive } = req.body;

    const banner = await AdBanner.findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (title !== undefined) banner.title = title.trim();
    if (linkUrl !== undefined) banner.linkUrl = linkUrl.trim();
    if (order !== undefined) banner.order = Number(order);
    if (isActive !== undefined) banner.isActive = Boolean(isActive);

    if (base64Data) {
      const bannersDir = path.join(__dirname, '../public/banners');
      if (!fs.existsSync(bannersDir)) {
        fs.mkdirSync(bannersDir, { recursive: true });
      }

      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `banner-${Date.now()}-${Math.round(Math.random() * 1e4)}.png`;
      const filePath = path.join(bannersDir, filename);

      fs.writeFileSync(filePath, buffer);
      banner.imageUrl = `/banners/${filename}`;
    } else if (imageUrl) {
      banner.imageUrl = imageUrl.trim();
    }

    if (width && height) {
      banner.width = Number(width);
      banner.height = Number(height);
      banner.aspectRatio = Number((banner.width / banner.height).toFixed(2));
    }

    await banner.save();

    res.status(200).json({
      success: true,
      message: 'Ad banner updated successfully!',
      banner,
    });
  } catch (error) {
    console.error('[AdBanner] Update banner error:', error);
    res.status(500).json({ success: false, message: 'Failed to update banner', error: error.message });
  }
};

// 5. ADMIN: Delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await AdBanner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    // Attempt to remove physical file if it was uploaded
    if (banner.imageUrl && banner.imageUrl.startsWith('/banners/banner-')) {
      const localPath = path.join(__dirname, '../public', banner.imageUrl);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (_) {}
      }
    }

    res.status(200).json({ success: true, message: 'Banner deleted successfully!' });
  } catch (error) {
    console.error('[AdBanner] Delete banner error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete banner', error: error.message });
  }
};
