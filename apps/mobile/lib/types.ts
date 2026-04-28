export type Address = {
    id: number;
    street_address: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    location_name: string;
    location_type: string;
    latitude: string;
    longitude: string;

};

export type DriverTruckInfo = {
    id: number;
    driver: string;
    truck_type: string;
    driver_phone: string;
};

export type Job = {
  id: number;
  job_number: string;
  project: string;
  job_date: string; // YYYY-MM-DD format
  shift_start: string; // HH:MM format
  material: string;
  job_foreman_name: string;
  job_foreman_contact: string;
  additional_notes: string | null;
  loading_address: number;
  unloading_address: number;
  loading_address_info: Address;
  unloading_address_info: Address;
  backhaul_loading_address_info: Address | null;
  backhaul_unloading_address_info: Address | null;
  is_backhaul_enabled: boolean;
  driver_assignments: DriverAssignment[];
};

export type DriverAssignment = {
    id: number;
    driver_truck_info: DriverTruckInfo;
    status: string;
    started_at: string | null; // ISO 8601 format or null
    on_site_at: string | null;
    completed_at: string | null;
    assigned_at: string;
    unassigned_at: string | null;
    backhaul_status: string | null;
    backhaul_started_at: string | null;
    backhaul_on_site_at: string | null;
    backhaul_completed_at: string | null;
};

export type Driver = {
    id: number;
    name: string;
    email_address: string;
    phone_number: string;
    address: string;
    driver_license: string;
    truck_count: number;
    contact_info: string;
    user: number;
    operator: number;
    created_at: string;
};

export type TicketPhoto = {
    id: number;
    photo: string 
};

export type Ticket = {
    id: number;
    date: string;
    submitted_at: string;
    photos: TicketPhoto[];
};
