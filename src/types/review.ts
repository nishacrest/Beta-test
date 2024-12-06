import { Types } from 'mongoose';

export interface CategoryRating {
	Evaluation: number;
	qualityOfMassage: number;
	cleanliness: number;
	park: number;
	pricing: number;
}

export interface ReplyLikes {
	count: number; // Count of likes for the reply
	likedBy: string[]; // Array of user IDs or emails who liked the reply
}
export interface Reply {
	replyerEmail: string;
	replyerName: string;
	replyText: string;
	createdAt: Date;
	replies: Reply[];
	likes: ReplyLikes;
	is_replied: boolean;
}

// types/review.ts
// export enum ReportReason {
// 	NOT_RELEVANT = "Not relevant",
// 	SPAM = "Spam",
// 	CONFLICT_OF_INTEREST = "Conflict of interest",
// 	PROFANITY = "Profanity",
// 	BULLYING_OR_HARASSMENT = "Bullying or harassment",
// 	DISCRIMINATION_OR_HATE_SPEECH = "Discrimination or hate speech",
// 	PERSONAL_DATA = "Personal data",
// }

export interface Report {
	// reason: ReportReason; 
	description?: string; // Optional description field
	createdAt: Date; // Timestamp of the report
	listingId: string,
}

export interface ReviewAttributes {
	_id: Types.ObjectId;
	listingId: Types.ObjectId;
	reviewerEmail: string | null;
	reviewerName: string | null;
	reviewText: string;
	rating: number | null;
	categoryRatings: CategoryRating | null;
	images: string[];
	comment: string | null;
	likes: {
		count: number | 0; // Count of likes
		likedBy: string[]; // Array of user IDs or emails who liked the review
	};
	replies: Reply[];
	reports?: Report[];
	createdAt: Date;
	deleted_at: Date | null;
}

export type ReviewInput = Omit<ReviewAttributes, '_id' | 'createdAt'>;
