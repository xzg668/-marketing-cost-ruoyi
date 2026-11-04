import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'

const root = '/api/v1/monthly-reprice/price-folders'
const post = (path, body) => request(`${root}${path}`, { method: 'POST', body, timeout: 300000, suppressErrorToast: true })
export const latestPriceFolder = pricingMonth => request(`${root}/latest`, { params: { pricingMonth } })
export const readPriceFolder = id => request(`${root}/${id}`)
export const startPriceFolder = body => post('', body)
export const addPriceFolderFiles = (id, revision, paths) => post(`/${id}/files`, { revision, paths })
export const uploadPriceFolderFile = (id, fileId, file) => {
  const body = new FormData(); body.append('file', file)
  return post(`/${id}/files/${fileId}`, body)
}
export const priceFolderUploadFailed = (id, fileId, message) => post(`/${id}/files/${fileId}/upload-failed`, { message })
export const processPriceFolderFile = (id, fileId, revision) => post(`/${id}/files/${fileId}/process`, { revision })
export const completePriceFolder = (id, revision) => post(`/${id}/complete`, { revision })
export const downloadPriceFolderOriginal = (id, file) => downloadAuthenticatedBlob(`${root}/${id}/files/${file.id}/original`, file.path.split('/').pop())
