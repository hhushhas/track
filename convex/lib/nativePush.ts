'use node'

import { sendApnsBatch } from './apns'
import { sendFcmBatch } from './fcm'
import type { NativePushInput, NativePushResult } from './pushProviderTypes'

export async function sendNativePushBatch(inputs: NativePushInput[]): Promise<NativePushResult[]> {
  if (!inputs.length || inputs.length > 100) throw new Error('native_push_batch_size_invalid')
  const results: Array<NativePushResult | undefined> = Array.from({ length: inputs.length })
  const apns = inputs.flatMap((input, index) =>
    input.platform === 'ios' ? [{ index, input }] : [])
  const fcm = inputs.flatMap((input, index) =>
    input.platform === 'android' ? [{ index, input }] : [])
  const [apnsResults, fcmResults] = await Promise.all([
    sendApnsBatch(apns.map((item) => item.input)),
    sendFcmBatch(fcm.map((item) => item.input)),
  ])
  apns.forEach((item, index) => {
    results[item.index] = apnsResults[index]
  })
  fcm.forEach((item, index) => {
    results[item.index] = fcmResults[index]
  })
  return results.map((result) => result!)
}
