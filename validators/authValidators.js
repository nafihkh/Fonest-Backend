const Joi = require("joi");

const phoneRegex = /^[0-9]{10}$/;

const sendOtpSchema = Joi.object({
  contact: Joi.alternatives()
    .try(
      Joi.string().email(),
      Joi.string().pattern(phoneRegex).messages({
        "string.pattern.base": "Phone must be 10 digits"
      })
    )
    .required()
});

const verifyOtpSchema = Joi.object({
  contact: Joi.alternatives()
    .try(
      Joi.string().email(),
      Joi.string().pattern(phoneRegex).messages({
        "string.pattern.base": "Phone must be 10 digits"
      })
    )
    .required(),
  otp: Joi.string().pattern(/^[0-9]{6}$/).required(),
  name: Joi.string().min(2).max(60).optional()
});

module.exports = { sendOtpSchema, verifyOtpSchema };