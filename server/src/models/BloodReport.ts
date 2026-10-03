import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A blood report. Test values are stored ONLY in canonical units (normalized at
 * intake); the originally submitted value/unit is kept for transparency.
 */
const testEntrySchema = new Schema(
  {
    value: { type: Number, required: true },
    /** Canonical unit for this test (e.g. g/dL). */
    unit: { type: String, required: true },
    /** Value exactly as submitted by the user (pre-conversion). */
    submittedValue: { type: Number, required: true },
    submittedUnit: { type: String, required: true },
    labRange: {
      low: { type: Number },
      high: { type: Number },
    },
  },
  { _id: false }
);

const reportSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    /** Snapshot of patient basics at the time of the report (keeps history truthful). */
    patientSnapshot: {
      name: { type: String, trim: true, maxlength: 120 },
      age: { type: Number, required: true, min: 0, max: 120 },
      sex: { type: String, enum: ['male', 'female', 'other'], required: true },
    },
    context: {
      bmi: { type: Number },
      weightKg: { type: Number },
      heightCm: { type: Number },
      systolicBp: { type: Number },
      diastolicBp: { type: Number },
      smoker: { type: String, enum: ['never', 'former', 'current'] },
      familyHistoryDiabetes: { type: Boolean },
    },
    reportDate: { type: Date, required: true, index: true },
    labName: { type: String, trim: true, maxlength: 120 },
    fasting: { type: Boolean },
    notes: { type: String, trim: true, maxlength: 1000 },
    /** Which analysis/engine version handled this report (filled at prediction time). */
    tests: { type: Map, of: testEntrySchema, required: true },
    source: { type: String, enum: ['manual', 'demo'], default: 'manual' },
    demoLabel: { type: String, trim: true }, // e.g. "DEMO / SYNTHETIC DATA — NOT FOR CLINICAL USE"
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

reportSchema.index({ owner: 1, reportDate: -1 });

export type BloodReportDoc = InferSchemaType<typeof reportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BloodReport = model('BloodReport', reportSchema);
