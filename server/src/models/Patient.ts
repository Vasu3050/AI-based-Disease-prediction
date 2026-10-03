import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A patient profile owned by a user. Deliberately minimal — no government IDs,
 * no contact details beyond an optional display name. Health data lives in
 * blood reports; patient records hold only what is needed to interpret them.
 */
const patientSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sex: { type: String, enum: ['male', 'female', 'other'], required: true },
    birthYear: { type: Number, min: 1900, max: 2100 },
    /** Alternate identifier used by the report's laboratory (optional). */
    externalRef: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

patientSchema.index({ owner: 1, name: 1 });

export type PatientDoc = InferSchemaType<typeof patientSchema> & { _id: mongoose.Types.ObjectId };

export const Patient = model('Patient', patientSchema);
