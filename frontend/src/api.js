import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })

export const getAuthStatus = () => api.get('/auth/status')
export const getAuthUrl   = () => api.get('/auth/google')
export const getJobs      = ()   => api.get('/jobs')
export const getJob       = (id) => api.get(`/jobs/${id}`)
export const getStats        = () => api.get('/stats')
export const getSankeyStats  = () => api.get('/stats/sankey')
export const triggerScan  = () => api.post('/scan')
export const deleteJob    = (id) => api.delete(`/jobs/${id}`)
export const getJobEvents      = (id)         => api.get(`/jobs/${id}/events`)
export const updateJobStatus   = (id, status)          => api.patch(`/jobs/${id}`, { status })
export const deleteJobEvent    = (jobId, eventId)      => api.delete(`/jobs/${jobId}/events/${eventId}`)
