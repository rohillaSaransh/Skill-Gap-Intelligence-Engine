const mongoose = require('mongoose');

const skillAliasSchema = new mongoose.Schema(
  {
    alias: { type: String, required: true, trim: true, lowercase: true },
    normalized_name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

skillAliasSchema.index({ alias: 1 }, { unique: true });

module.exports = mongoose.models?.SkillAlias || mongoose.model('SkillAlias', skillAliasSchema);
