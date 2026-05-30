const Category = require('../models/Category');

exports.createCategory = async (req, res, next) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    const category = await Category.create({ name, slug });
    res.status(201).json({ message: 'Category created', category });
  } catch (err) {
    next(err);
  }
};
