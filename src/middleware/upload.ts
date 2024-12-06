import multerS3 from 'multer-s3';
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
const AWS = require('aws-sdk');
import dotenv from 'dotenv';
dotenv.config();

const imageFileFilter = (
	req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback
) => {
	if (
		file.mimetype === 'image/png' ||
		file.mimetype === 'image/jpeg' ||
		file.mimetype === 'image/jpg'
	) {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

const pdfFileFilter = (
	req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback
) => {
	if (file.mimetype === 'application/pdf') {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

const s3Config = new AWS.S3({
	accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
	Bucket: process.env.AWS_S3_BUCKET_NAME,
});

const multerS3ConfigForGiftcardTemplate = multerS3({
	s3: s3Config,
	bucket: process.env.AWS_S3_BUCKET_NAME as string,
	metadata(req, file, cb) {
		cb(null, { fieldName: file.fieldname });
	},
	key(req, file, cb) {
		cb(null, `giftcard-templates/${new Date().getTime()}-${file.originalname}`);
	},
	contentType: multerS3.AUTO_CONTENT_TYPE,
});

export const imageFileForGiftcardTemplate = multer({
	storage: multerS3ConfigForGiftcardTemplate,
	fileFilter: imageFileFilter,
	limits: {
		fileSize: 1024 * 1024 * 5, // 5 MB image size
	},
});

const multerS3ConfigForShopLogo = multerS3({
	s3: s3Config,
	bucket: process.env.AWS_S3_BUCKET_NAME as string,
	metadata(req, file, cb) {
		cb(null, { fieldName: file.fieldname });
	},
	key(req, file, cb) {
		cb(null, `shop-logos/${new Date().getTime()}-${file.originalname}`);
	},
	contentType: multerS3.AUTO_CONTENT_TYPE,
});

export const imageFileForShopLogo = multer({
	storage: multer.memoryStorage(),
	fileFilter: imageFileFilter,
	limits: {
		fileSize: 1024 * 1024 * 0.5,
	},
});

export const pdfFileForNegotiationInvoice = multer({
	storage: multer.memoryStorage(),
	fileFilter: pdfFileFilter,
	limits: {
		fileSize: 1024 * 1024 * 10,
	},
});

export const pdfFileForPaymentInvoice = multer({
	storage: multer.memoryStorage(),
	fileFilter: pdfFileFilter,
	limits: {
		fileSize: 1024 * 1024 * 10,
	},
});

export const pdfFileForRefundInvoice = multer({
	storage: multer.memoryStorage(),
	fileFilter: pdfFileFilter,
	limits: {
		fileSize: 1024 * 1024 * 10,
	},
});

const multerS3ConfigForListingImages = multerS3({
	s3: s3Config,
	bucket: process.env.AWS_S3_BUCKET_NAME as string,
	metadata(req, file, cb) {
		cb(null, { fieldName: file.fieldname });
	},
	key(req, file, cb) {
		// Store images in a 'listed-cities' folder in S3
		cb(null, `listed-img/${new Date().getTime()}-${file.originalname}`);
	},
	contentType: multerS3.AUTO_CONTENT_TYPE,
});

export const imageFileForListing = multer({
	storage: multerS3ConfigForListingImages,
	fileFilter: imageFileFilter,
	limits: {
	  fileSize: 1024 * 1024 * 10, 
	},
  }).fields([
	{ name: 'imageFiles', maxCount: 10 },  
	{ name: 'cityImages', maxCount: 10 }    
]);


// Multer S3 config for listed city images
const multerS3ConfigForReviewImages = multerS3({
	s3: s3Config,
	bucket: process.env.AWS_S3_BUCKET_NAME as string,
	metadata(req, file, cb) {
		cb(null, { fieldName: file.fieldname });
	},
	key(req, file, cb) {
		// Store images in a 'listed-cities' folder in S3
		cb(null, `review-for-listing/${new Date().getTime()}-${file.originalname}`);
	},
	contentType: multerS3.AUTO_CONTENT_TYPE,
});

// Multer instance for listed city images
export const imageFromReviewListing = multer({
	storage: multerS3ConfigForReviewImages,
	fileFilter: imageFileFilter, // Use the same image file filter
	limits: {
		fileSize: 1024 * 1024 * 10, 
	},
});
