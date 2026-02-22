import { EventData, EventField, EventStatus, FieldType, Registration, User, AuthResponse, DashboardStats } from '../types';

/*// Helper to separate API URL logic
const getApiUrl = () => {
  // Use Vite environment variables
  let url = import.meta.env.VITE_API_URL;

  if (!url) {
    if (import.meta.env.DEV) {
      return 'http://127.0.0.1:8000/api';
    }
    // New default for production
    return 'https://nexr-forms-backend.vercel.app/api';
  }

  // Ensure url does not end with slash
  url = url.replace(/\/$/, '');

  // If url doesn't end with /api, append it
  if (!url.endsWith('/api')) {
    url += '/api';
  }

  return url;
};*/
// Force the new backend URL regardless of what 'url' says
// 1. Unified URL Logic
const getBaseUrl = () => {
  // Use local backend if running in development mode
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000/api';
  }
  // Use Vercel backend for production
  return 'https://nexr-forms-backend.vercel.app/api';
};

// 2. Set the single constant that the rest of your app uses
export const API_URL = getBaseUrl();

// 3. Log it so you can verify in the browser console
console.log('EventFlow Configured API URL:', API_URL);

// 4. Headers configuration
const getHeaders = () => {
  const token = localStorage.getItem('eventflow_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};
// --- AUTH SERVICE ---

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Login failed');
  }
  const data = await res.json();
  localStorage.setItem('eventflow_token', data.token);
  return data;
};

export const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Registration failed');
  }
  const data = await res.json();
  localStorage.setItem('eventflow_token', data.token);
  return data;
};

// --- EVENTS SERVICE ---

// Helper to map backend field to frontend field
const mapField = (f: any): EventField => ({
  id: String(f.id),
  eventId: String(f.event_id),
  label: f.label,
  type: f.type,
  required: f.required,
  order: f.order_index,
  options: f.options || [],
  description: f.description,
  minValue: f.min_value,
  maxValue: f.max_value,
  fileTypes: f.file_types,
  maxFileSize: f.max_file_size,
  imageUrl: f.image_url,
  logic: f.logic
});

// Helper to map backend event to frontend event
const mapEvent = (e: any): EventData => ({
  ...e,
  id: String(e.id),
  organizerId: String(e.organizer_id),
  startDateTime: e.start_date_time,
  endDateTime: e.end_date_time,
  maxSeats: e.max_seats,
  status: e.status ? e.status.toUpperCase() : 'DRAFT',
  registrationCount: e.registration_count || 0,
  limitOneResponse: e.limit_one_response,
  whatsappLink: e.whatsapp_link,
  isPaid: e.is_paid,
  fields: Array.isArray(e.fields) ? e.fields.map(mapField) : []
});

export const getEvents = async (userId: string): Promise<EventData[]> => {
  const res = await fetch(`${API_URL}/events`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch events');
  const events = await res.json();
  return events.map(mapEvent);
};

export const getOrganizerEvent = async (eventId: string): Promise<EventData | null> => {
  const res = await fetch(`${API_URL}/events/${eventId}`, { headers: getHeaders() });
  if (!res.ok) return null;
  const e = await res.json();
  return mapEvent(e);
};

export const getEventById = async (eventId: string): Promise<EventData | null> => {
  const res = await fetch(`${API_URL}/public/events/${eventId}`);
  if (!res.ok) return null;
  const e = await res.json();
  return mapEvent(e);
};

export const createEvent = async (userId: string, data: Partial<EventData>): Promise<EventData> => {
  console.log('DEBUG: createEvent payload:', data);
  try {
    const res = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('DEBUG: createEvent error response:', res.status, errorText);
      throw new Error(`Failed to create event: ${res.status} ${errorText}`);
    }

    const e = await res.json();
    console.log('DEBUG: createEvent success:', e);
    return mapEvent(e);
  } catch (error) {
    console.error('DEBUG: createEvent exception:', error);
    throw error;
  }
};

export const updateEvent = async (eventId: string, updates: Partial<EventData>): Promise<EventData> => {
  const res = await fetch(`${API_URL}/events/${eventId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update event');
  const e = await res.json();
  return mapEvent(e);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/events/${eventId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete event');
};

// --- REGISTRATION SERVICE ---

export const submitRegistration = async (eventId: string, answers: Record<string, any>): Promise<Registration> => {
  const res = await fetch(`${API_URL}/public/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, eventId: Number(eventId) })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Registration failed');
  }
  const r = await res.json();
  return {
    ...r,
    eventId: r.event_id,
    submittedAt: r.submitted_at
  };
};

export const getEventRegistrations = async (eventId: string): Promise<Registration[]> => {
  const res = await fetch(`${API_URL}/events/${eventId}/registrations`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch registrations');
  const regs = await res.json();
  return regs.map((r: any) => ({
    ...r,
    eventId: r.event_id,
    submittedAt: r.submitted_at,
    verified: r.verified,
    paymentStatus: r.payment_status
  }));
};

export const approveRegistration = async (eventId: string, regId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/events/${eventId}/registrations/${regId}/approve`, {
    method: 'PUT',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to approve registration');
};

export const rejectRegistration = async (eventId: string, regId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/events/${eventId}/registrations/${regId}/reject`, {
    method: 'PUT',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to reject registration');
};

export const getDashboardStats = async (userId: string): Promise<DashboardStats> => {
  // Ideally backend should provide this. For now, we fetch events and calc.
  const events = await getEvents(userId);
  const now = new Date();

  return {
    totalEvents: events.length,
    totalRegistrations: events.reduce((acc, e) => acc + (e.registrationCount || 0), 0),
    upcomingEvents: events.filter(e => new Date(e.startDateTime) > now).length
  };
};

// --- POSTS SERVICE ---

export const createPost = async (title: string, content: string) => {
  try {
    const res = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title, content })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create post');
    }
    return await res.json();
  } catch (error) {
    console.error("Create Post Error:", error);
    throw error;
  }
};