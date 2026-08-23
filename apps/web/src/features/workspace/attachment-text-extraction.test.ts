import { describe, expect, it } from 'vitest'

import {
  extractAttachmentText,
} from '../../../../../convex/lib/attachmentTextExtraction'

const tinyDocxFixture =
  'UEsDBBQAAAAIAFtyxFwik2NzbAAAAHQAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbBWMwQ3CMAwAV4n8bx14IISa9scEZYAomLSC2FFsIdie8Dzd6ablU17uTU134QCH0YMjTnLfOQe4rdfhDMs8rd9K6nrKGmAzqxdETRuVqKNU4m4e0kq0ji1jjekZM+HR+xMmYSO2wf4PcDj/AFBLAwQUAAAACABbcsRcu/JbkdUAAAD+AQAAEQAAAHdvcmQvZG9jdW1lbnQueG1sjZFNbsIwEIX3PYXFossaddFFSnOFLuACjjMQS/GPZiYy3J6xAyIICfDiSf7G8+bZ/lB1bXLTRzt5CKyOfgzU5L/VwJwarckO4A19xQRBavuI3rBs8aBzxD5htEDkwsGP+nu9/tHeuLBqL87Vu4v96QYqSq0IFuF2O3Vk0SV2MSiyMmijCy8qR0TTs26WVlAIdkKUGCqZU7kIqU/j068UAmQzqt4w0Ctj7sYlmRneoxnaMn2Z4z8HwEf/SuxbDjvTORres6jsLlgly/gFLF++7K+/PLMzUEsBAhQAFAAAAAgAW3LEXCKTY3NsAAAAdAAAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACABbcsRcu/JbkdUAAAD+AQAAEQAAAAAAAAAAAAAAAACdAAAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAIAAgCAAAAAoQEAAAAA'

function decodeBase64Fixture(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

describe('attachment text extraction', () => {
  it('extracts readable text from docx attachments', () => {
    const extracted = extractAttachmentText({
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      data: decodeBase64Fixture(tinyDocxFixture),
      filename: 'Proposal DM Subscription Internal.docx',
    })

    expect(extracted).toEqual({
      ok: true,
      text: 'Subscription scope\nStripe recurring payments & renewal dates\nOwner\nTabish',
      type: 'docx',
    })
  })
})
