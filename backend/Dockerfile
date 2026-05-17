FROM public.ecr.aws/lambda/nodejs:20

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Handler entry point for Lambda (overridden from Terraform image_config, kept here for clarity)
CMD ["lambda.handler"]
