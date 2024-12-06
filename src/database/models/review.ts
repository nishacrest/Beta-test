import mongoose, { Schema, Document } from 'mongoose';
import { ReviewInput } from '../../types/review';

const replySchema: Schema = new Schema(
	{
		replyerEmail: { type: String, required: true },
		replyerName: { type: String },
		replyText: { type: String, required: true },
		createdAt: { type: Date, default: Date.now },
		likes: {
			count: { type: Number, default: 0 }, 
			likedBy: { type: [String], default: [] }, 
		},
		is_replied: { type: Schema.Types.Boolean, default: false },
		replies: [
			{
				type: new Schema(
					{
						replyerEmail: { type: String, required: true },
						replyText: { type: String, required: true },
						createdAt: { type: Date, default: Date.now },
						likes: {
							count: { type: Number, default: 0 },
							likedBy: { type: [String], default: [] }, 
						},
						replies: [
							{
								type: Schema.Types.Mixed,
								default: [],
							},
						],
					},
					{ _id: true }
				),
				default: [],
			},
		],
	},
	{ _id: true }
);

const reportSchema: Schema = new Schema(
	{
		// reason: { type: String, enum: Object.values(ReportReason), required: true },
		description: { type: String, required: false }, // Optional description field
		createdAt: { type: Date, default: Date.now },
		listingId: { type: String, required: true },
	},
	{ _id: true }
);

const reviewSchema: Schema = new Schema({
	listingId: { type: mongoose.Types.ObjectId, ref: 'Listing', required: true },
	reviewerEmail: {
		type: Schema.Types.String,
	},
	reviewerName: {
		type: Schema.Types.String,
	},
	reviewText: {
		type: Schema.Types.String,
	},
	images: {
		type: [Schema.Types.String],
	},
	rating: {
		type: Schema.Types.Number,
	},
	categoryRatings: {
		Evaluation: { type: Number },
		qualityOfMassage: { type: Number },
		cleanliness: { type: Number },
		park: { type: Number },
		pricing: { type: Number },
	},
	comment: {
		type: Schema.Types.String,
	},
	likes: {
		count: { type: Number, default: 0 }, // Initialize like count to 0
		likedBy: { type: [String], default: [] }, // Array to store user IDs or emails
	},
	replies: [replySchema],
	is_verified: {
		type: Schema.Types.Boolean,
	},
	reports: [reportSchema],
	createdAt: { type: Date, default: Date.now },
	deleted_at: { type: Date, default: null },
});

export const Review = mongoose.model<ReviewInput>('Review', reviewSchema);
