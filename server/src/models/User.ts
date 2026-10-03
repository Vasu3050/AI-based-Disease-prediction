import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

const settingsSchema = new Schema(
  {
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    highContrastCharts: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    disabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User = model('User', userSchema);
