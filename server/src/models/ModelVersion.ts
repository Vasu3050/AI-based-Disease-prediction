import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

/** Registry of trained model artifacts known to the system (synced on boot). */
const modelVersionSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    targetId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    version: { type: String, required: true },
    trainedAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
    metrics: { type: Schema.Types.Mixed },
    dataset: { type: Schema.Types.Mixed },
    features: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

export type ModelVersionDoc = InferSchemaType<typeof modelVersionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ModelVersion = model('ModelVersion', modelVersionSchema);
