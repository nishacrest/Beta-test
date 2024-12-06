import path from 'path';

const swaggerOptions = {
	definition: {
		openapi: '3.0.1',
		info: {
			title: 'Giftcard Express API with Swagger',
			version: '0.1.0',
			description:
				'Giftcard application made with Express and documented with Swagger',
			license: {
				name: 'MIT',
				url: 'https://spdx.org/licenses/MIT.html',
			},
			contact: {
				name: 'Giftcard',
			},
		},
		servers: [
			{
				url: process.env.BASE_URL,
			},
		],
		components: {
			securitySchemes: {
				userBearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
					description: 'Enter the token',
				},
				adminBearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
					description: 'Enter the token',
				},
			},
		},
		// security: [{ bearerAuth: [] }],
	},
	apis: [path.resolve(__dirname, '../routes/api/*.js')],
};

export default swaggerOptions;
