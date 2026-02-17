const mongoose = require('mongoose');

const CATEGORIES = [
  'programming_language',
  'tool',
  'certification',
  'database',
  'operating_system',
  'general_skill',
];

const skillMasterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
    },
  },
  { timestamps: true }
);

skillMasterSchema.index({ name: 1, category: 1 }, { unique: true });
skillMasterSchema.index({ name: 1 });

module.exports = mongoose.models?.SkillMaster || mongoose.model('SkillMaster', skillMasterSchema);
