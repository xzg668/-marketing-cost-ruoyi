import { request } from './http'

export const fetchAuxSubjects = (params) =>
  request('/api/v1/aux-subjects', { params })

export const importAuxSubjects = (body) =>
  request('/api/v1/aux-subjects/import', { method: 'POST', body })

export const createAuxSubject = (body) =>
  request('/api/v1/aux-subjects', { method: 'POST', body })

export const updateAuxSubject = (id, body) =>
  request(`/api/v1/aux-subjects/${id}`, { method: 'PATCH', body })

export const deleteAuxSubject = (id) =>
  request(`/api/v1/aux-subjects/${id}`, { method: 'DELETE' })

export const fetchAuxSubjectQuote = (params) =>
  request('/api/v1/aux-subjects/quote', { params })
