import { request } from './http'

const BASE_PATH = '/api/v1/price-linked'

export const fetchQuoteBaseMappingRules = (params) =>
  request(`${BASE_PATH}/quote-base-mapping-rules`, { params })

export const createQuoteBaseMappingRule = (body) =>
  request(`${BASE_PATH}/quote-base-mapping-rules`, { method: 'POST', body })

export const updateQuoteBaseMappingRule = (id, body) =>
  request(`${BASE_PATH}/quote-base-mapping-rules/${id}`, { method: 'PUT', body })

export const setQuoteBaseMappingRuleEnabled = (id, enabled) =>
  request(`${BASE_PATH}/quote-base-mapping-rules/${id}/enabled`, {
    method: 'PUT',
    body: { enabled },
  })

export const deleteQuoteBaseMappingRule = (id) =>
  request(`${BASE_PATH}/quote-base-mapping-rules/${id}`, { method: 'DELETE' })

export const fetchFactorQuoteBaseMappings = (params) =>
  request(`${BASE_PATH}/factor-quote-base-mappings`, { params })
