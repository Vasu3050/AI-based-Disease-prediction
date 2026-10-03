import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A stored prediction: the structured analysis result for one report plus an
 * optional (clearly separated) LLM-generated explanation.
 */
const explanationSchema = new Schema(
  {
    source: { type: String, enum: ['llm', 'template'], required: true },
    provider: { type: String },
    model: { type: String },
    generatedAt: { type: Date, required: true },
    fallbackReason: { type: String },
    /** Validated structured explanation (see ai/explain.ts schema). */
    content: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const predictionSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    report: { type: Schema.Types.ObjectId, ref: 'BloodReport', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    engineVersion: { type: String, required: true },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    results: { type: Schema.Types.Mixed, required: true },
    modelVersions: [
      {
        _id: false,
        key: { type: String },
        version: { type: String },
      },
    ],
    explanation: { type: explanationSchema },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

predictionSchema.index({ owner: 1, createdAt: -1 });

export type PredictionDoc = mongoose.HydratedDocument<InferSchemaType<typeof predictionSchema>>;

export const Prediction = model('Prediction', predictionSchema);
