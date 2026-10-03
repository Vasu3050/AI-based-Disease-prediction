import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Audit log for security-relevant events. Deliberately stores NO lab values
 * and no free-text health data — only actions, entity references and request
 * metadata.
 */
const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: { type: String, trim: true }, // denormalized for admin display
    action: { type: String, required: true, index: true },
    entityType: { type: String },
    entityId: { type: String },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String, maxlength: 400 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditLog = model('AuditLog', auditLogSchema);
