const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
  },
  slug: {
    type: String,
    required: [true, 'Category slug is required'],
    lowercase: true,
    trim: true,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  image: {
    type: String,
    default: '',
  },
}, { timestamps: true });

categorySchema.index({ name: 1, parent: 1 }, { unique: true });
categorySchema.index({ slug: 1, parent: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
