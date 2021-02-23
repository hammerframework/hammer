/*

Based on Stripe's secure webhook implementation
See: https://stripe.com/docs/webhooks/signatures

*/

import { createHmac } from 'crypto'

import { ForbiddenError } from 'apollo-server-lambda'
import type { APIGatewayProxyEvent } from 'aws-lambda'

/**
 * @const {string}
 */
const ERROR_MESSAGE = "You don't have access to invoke this function."

/**
 * @const {number}
 */
const FIVE_MINUTES = 5 * 60 * 1000

/**
 * @const {number}
 */
const DEFAULT_TOLERANCE = FIVE_MINUTES

/**
 * @const {string}
 */
const WEBHOOK_SECRET = process.env['WEBHOOK_SECRET'] || ''

/**
 * @const {string}
 */
export const WEBHOOK_SIGNTAURE_HEADER = 'RW-WEBHOOK-SIGNATURE'

/**
 * VerifyOptions
 * Used when verifying a signature's time component for permitted leeway.
 *
 * @typedef {Object} VerifyOptions
 * @property {number} tolerance - Optional tolerance in msec
 * @property {number} timestamp - Optional timestamp in msec
 */
export interface VerifyOptions {
  tolerance?: number
  timestamp?: number
}

/**
 * Generates a hash-based message authentication code from a secret.
 *
 * @param {string} secret - Secret key used to sign
 * @return {string} - A HMAC
 *
 * @example
 *
 *    getHmac({ secret: 'MY_SECRET' })
 */
const getHmac = ({ secret }: { secret: string }) => {
  if (secret === undefined || secret === '')
    throw new ForbiddenError(ERROR_MESSAGE)
  return createHmac('sha256', secret)
}

/**
 * Extracts signature from Lambda Event.
 *
 * @param {APIGatewayProxyEvent} event - The event that incudes the request details, like headers
 * @return {string} - The header found in WEBHOOK_SIGNTAURE_HEADER
 *
 * @example
 *
 *    signatureFromEvent({ event: event })
 */
const signatureFromEvent = ({
  event,
}: {
  event: APIGatewayProxyEvent
}): string => {
  return event?.headers?.[WEBHOOK_SIGNTAURE_HEADER.toLocaleLowerCase()]
}

/*
 * The Redwood-Webhook-Signature header included in each signed event contains a timestamp and one or more signatures.
 * The timestamp is prefixed by t=, and each signature is prefixed by a scheme. Schemes start with v, followed by an integer.
 * Currently, the only valid live signature scheme is v1.
 *
 * The signed_payload string is created by concatenating:
 *
 * The timestamp (as a string)
 * The character .
 * The actual JSON payload (i.e., the request body)
 *
 * @param {string} body - The body payload to sign.
 * @param {string} secret - The secret key used to sign. Defaults to WEBHOOK_SECRET.
 * @param {number} timestamp - Timestamp in msec used to sign. Defaults to now.
 * @return {string} - The signature
 *
 * @example
 *
 *    sign({ body: 'This is some content to sign.' })
 */
export const sign = ({
  body,
  secret = WEBHOOK_SECRET,
  timestamp = Date.now(),
}: {
  body: string
  secret: string
  timestamp: number
}): string => {
  const hmac = getHmac({ secret })
  hmac.update(timestamp + '.' + body)

  return `t=${timestamp},v1=${hmac.digest('hex')}`
}

/**
 * Verifies event is signed with a valid webhook signature.
 * See verifySignature() for implementation rules.
 *
 * @param {APIGatewayProxyEvent} event - The event that incudes the request details, like headers.
 * @param {VerifyOptions} options - Options for verifying the timestamp leeway.
 * @return {boolean \ ForbiddenError} - Returns true if the signature is verified, or raises ForbiddenError.
 *
 * @example
 *
 *    verify({ event: event, options: {} })*
 */
export const verify = ({
  event,
  options,
}: {
  event: APIGatewayProxyEvent
  options?: VerifyOptions
}): boolean | ForbiddenError => {
  const body = event.body || ''
  const signature = signatureFromEvent({ event })

  return verifySignature({
    body,
    secret: WEBHOOK_SECRET,
    signature,
    options,
  })
}

/**
 * Logic to verify the body payload with a given signature.
 *
 * The value for the prefix t corresponds to the timestamp, and v1 corresponds to the signature (or signatures).
 *
 * Compare the signature (or signatures) in the header to the expected signature.
 * For an equality match, we compute the tolerance between the current timestamp and the received timestamp,
 * then decide if the tolerance is within your tolerance -- in our case this is 5 minutes.
 *
 * Because this timestamp is part of the signed payload, it is also verified by the signature,
 * so an attacker cannot change the timestamp without invalidating the signature.
 * If the signature is valid but the timestamp is too old, we reject the payload.
 *
 * This tolerance protects against timing attacks by comparing the expected signature to each of the received signatures.
 *
 * @param {string} body - The body payload.
 * @param {string} secret - The secret key used to sign. Defaults to WEBHOOK_SECRET.
 * @param {string} signature - The signature.
 * @param {VerifyOptions} options - Options for verifying the timestamp leeway.
 * @return {boolean \ ForbiddenError} - Returns true if the signature is verified, or raises ForbiddenError.
 *
 * @example
 *
 *    verifySignature({ body: event,
 *                      signature: 't=1535555109,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd`',
 *                      options: {} })
 */

export const verifySignature = ({
  body,
  secret = WEBHOOK_SECRET,
  signature,
  options = {},
}: {
  body: string
  secret: string
  signature: string
  options?: VerifyOptions
}): boolean | ForbiddenError => {
  const match = /t=(\d+),v1=([\da-f]+)/.exec(signature)
  if (!match) {
    throw new ForbiddenError(ERROR_MESSAGE)
  }

  const signedStamp = Number(match[1])
  const payload = match[2]

  const timestamp = options?.timestamp ?? Date.now()
  const tolerance = options?.tolerance ?? DEFAULT_TOLERANCE

  const difference = Math.abs(timestamp - signedStamp)

  if (difference > tolerance) {
    throw new ForbiddenError(ERROR_MESSAGE)
  }

  const hmac = getHmac({ secret })
  hmac.update(signedStamp + '.' + body)

  if (hmac.digest('hex') === payload) {
    return true
  }

  throw new ForbiddenError(ERROR_MESSAGE)
}