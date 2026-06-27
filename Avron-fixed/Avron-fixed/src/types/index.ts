export type HospitalRole =
  | 'super_admin' | 'md' | 'department_head' | 'floor_supervisor'
  | 'staff' | 'it_team' | 'maintenance_team' | 'biomedical_team';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'critical';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type AuditAction =
  | 'login' | 'logout' | 'create' | 'update' | 'delete'
  | 'assign' | 'approve' | 'reject' | 'transfer' | 'reset_password' | 'otp_request';

// Phase 2
export type BedStatus = 'available' | 'occupied' | 'maintenance' | 'reserved';
export type RoomType = 'general_ward' | 'private_room' | 'suite' | 'icu' | 'ot' | 'recovery' | 'nursing_station' | 'other';
export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed';

// Phase 3
export type RequisitionType = 'ot_medication' | 'chemo_drug' | 'lab' | 'radiology' | 'bed_transfer' | 'bed_change' | 'general';
export type WorkflowStatus = 'created' | 'approved' | 'processing' | 'delivered' | 'completed' | 'rejected';
export type DischargeStatus = 'initiated' | 'pharmacy_cleared' | 'billing_cleared' | 'completed';

// Phase 4
export type TicketType = 'it' | 'maintenance' | 'biomedical' | 'fms';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'escalated' | 'resolved' | 'closed' | 'reopened';

// Phase 5
export type DeptReqStatus = 'requested' | 'approved' | 'processing' | 'dispensed' | 'delivered' | 'completed' | 'rejected';
export type RadiologyModality = 'xray' | 'ct' | 'mri' | 'usg' | 'mammography' | 'doppler' | 'fluoroscopy';
export type LabStatus = 'sample_pending' | 'sample_collected' | 'processing' | 'report_ready' | 'delivered';

// Phase 6
export type DeliveryStatus = 'created' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';

// Phase 8
export type AssetType = 'computer' | 'laptop' | 'printer' | 'cctv' | 'biomedical' | 'network_device' | 'furniture' | 'vehicle' | 'other';
export type AssetStatus = 'active' | 'inactive' | 'under_maintenance' | 'disposed' | 'lost';

// ─── Core Entities ──────────────────────────────────────────────────────────

export interface Department {
  id: string; name: string; floor: string; description: string | null;
  head_id: string | null; is_active: boolean; created_at: string; updated_at: string;
  head?: Profile;
}

export interface Profile {
  id: string; full_name: string; employee_id: string | null; role: HospitalRole;
  department_id: string | null; phone: string | null; avatar_url: string | null;
  is_active: boolean; last_login: string | null; created_at: string; updated_at: string;
  department?: Department; email?: string;
}

export interface Notification {
  id: string; user_id: string; title: string; message: string;
  type: NotificationType; priority: NotificationPriority;
  is_read: boolean; action_url: string | null; created_at: string;
}

export interface AuditLog {
  id: string; user_id: string | null; action: AuditAction;
  entity_type: string | null; entity_id: string | null;
  details: Record<string, unknown>; ip_address: string | null; created_at: string;
  profile?: Profile;
}

// Phase 2
export interface Room {
  id: string; room_number: string; floor: string; room_type: RoomType;
  department_id: string | null; total_beds: number; description: string | null;
  is_active: boolean; created_at: string; updated_at: string;
  beds?: Bed[];
}

export interface Bed {
  id: string; room_id: string; bed_number: string; status: BedStatus;
  patient_name: string | null; patient_uhid: string | null;
  admitted_at: string | null; notes: string | null; created_at: string; updated_at: string;
  room?: Room;
}

export interface BedAllocation {
  id: string; bed_id: string; room_id: string; patient_name: string;
  patient_uhid: string | null; age: number | null; gender: string | null;
  diagnosis: string | null; allocated_by: string | null; discharged_by: string | null;
  allocated_at: string; discharged_at: string | null; notes: string | null;
}

export interface BedTransferRequest {
  id: string; from_bed_id: string; to_bed_id: string; patient_name: string;
  reason: string | null; requested_by: string | null; approved_by: string | null;
  status: TransferStatus; notes: string | null; created_at: string; updated_at: string;
}

// Phase 3
export interface Requisition {
  id: string; req_number: string; type: RequisitionType; status: WorkflowStatus;
  priority: 'routine' | 'urgent' | 'emergency'; patient_name: string | null;
  patient_uhid: string | null; department_id: string | null; requested_by: string | null;
  notes: string | null; scheduled_for: string | null; created_at: string; updated_at: string;
  items?: RequisitionItem[]; department?: Department;
}

export interface RequisitionItem {
  id: string; requisition_id: string; item_name: string;
  quantity: number; unit: string; notes: string | null; created_at: string;
}

export interface DischargeRequest {
  id: string; patient_name: string; patient_uhid: string | null;
  bed_id: string | null; room_id: string | null; diagnosis: string | null;
  status: DischargeStatus; initiated_by: string | null;
  nursing_notes: string | null; pharmacy_notes: string | null; billing_notes: string | null;
  total_bill: number; pharmacy_cleared_at: string | null; billing_cleared_at: string | null;
  completed_at: string | null; created_at: string; updated_at: string;
}

// Phase 4
export interface Ticket {
  id: string; ticket_number: string; title: string; description: string;
  type: TicketType; priority: TicketPriority; status: TicketStatus;
  department_id: string | null; location: string | null;
  created_by: string | null; assigned_to: string | null; resolved_by: string | null;
  sla_deadline: string | null; assigned_at: string | null; resolved_at: string | null;
  closed_at: string | null; resolution_notes: string | null;
  proof_url: string | null; proof_uploaded_at: string | null; proof_uploaded_by: string | null;
  resolution_duration_seconds: number | null; self_assigned_at: string | null;
  created_at: string; updated_at: string;
  created_by_profile?: Profile; assigned_to_profile?: Profile; department?: Department;
}

export interface TicketComment {
  id: string; ticket_id: string; user_id: string | null;
  comment: string; is_internal: boolean; created_at: string; profile?: Profile;
}

// Phase 5
export interface DrugRequest {
  id: string; req_number: string; patient_name: string; patient_uhid: string | null;
  bed_id: string | null; medication: string; dosage: string | null; frequency: string | null;
  quantity: string | null; instructions: string | null; is_chemo: boolean;
  status: DeptReqStatus; requested_by: string | null; approved_by: string | null;
  dispensed_by: string | null; approved_at: string | null; dispensed_at: string | null;
  notes: string | null; created_at: string; updated_at: string;
}

export interface RadiologyRequest {
  id: string; req_number: string; patient_name: string; patient_uhid: string | null;
  modality: RadiologyModality; body_part: string | null; clinical_notes: string | null;
  contrast: boolean; status: DeptReqStatus; requested_by: string | null;
  radiologist_id: string | null; report_text: string | null;
  image_urls: string[]; report_url: string | null;
  scheduled_at: string | null; completed_at: string | null;
  created_at: string; updated_at: string;
}

export interface LabRequest {
  id: string; req_number: string; patient_name: string; patient_uhid: string | null;
  test_panel: string; test_details: string | null; sample_type: string;
  status: LabStatus; requested_by: string | null; collected_by: string | null;
  processed_by: string | null; sample_id: string | null;
  report_text: string | null; report_url: string | null;
  collected_at: string | null; processed_at: string | null; report_ready_at: string | null;
  notes: string | null; created_at: string; updated_at: string;
}

export interface ChemoRequest {
  id: string; req_number: string; patient_name: string; patient_uhid: string | null;
  drug_name: string; cycle_number: number; dose: string | null; protocol: string | null;
  status: DeptReqStatus; requested_by: string | null; approved_by: string | null;
  dispensed_by: string | null; approved_at: string | null; dispensed_at: string | null;
  scheduled_date: string | null; notes: string | null; created_at: string; updated_at: string;
}

// Phase 6
export interface Delivery {
  id: string; delivery_number: string; entity_type: string; entity_id: string | null;
  title: string; description: string | null; from_location: string; to_location: string;
  status: DeliveryStatus; assigned_to: string | null; created_by: string | null;
  picked_up_at: string | null; in_transit_at: string | null; delivered_at: string | null;
  receiver_name: string | null; delivery_photo_url: string | null; delivery_notes: string | null;
  created_at: string; updated_at: string; assigned_profile?: Profile;
}

// Phase 8
export interface Asset {
  id: string; asset_tag: string; name: string; type: AssetType;
  brand: string | null; model: string | null; serial_number: string | null;
  qr_code: string | null; department_id: string | null; assigned_to: string | null;
  location: string | null; status: AssetStatus; condition: string | null;
  purchase_date: string | null; purchase_cost: number | null; warranty_expiry: string | null;
  notes: string | null; created_at: string; updated_at: string;
  department?: Department; assigned_profile?: Profile;
}

export interface AssetMaintenanceLog {
  id: string; asset_id: string; maintenance_type: string; description: string;
  performed_by: string | null; vendor: string | null; cost: number | null;
  scheduled_at: string | null; completed_at: string | null; next_service_date: string | null;
  parts_replaced: string | null; notes: string | null; created_at: string;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export type AppRoute =
  | 'login' | 'admin-portal' | 'forgot-password' | 'register' | 'initialize-md'
  | 'dashboard' | 'users' | 'departments' | 'floor-map'
  | 'notifications' | 'audit-logs' | 'profile' | 'settings'
  | 'bed-management' | 'requisitions' | 'discharge'
  | 'tickets' | 'ticket-detail'
  | 'pharmacy' | 'radiology' | 'lab' | 'chemo'
  | 'media' | 'deliveries'
  | 'assets';

// ─── Constants ───────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<HospitalRole, string> = {
  super_admin: 'Super Admin', md: 'Medical Director',
  department_head: 'Department Head', floor_supervisor: 'Floor Supervisor',
  staff: 'Staff', it_team: 'IT Team',
  maintenance_team: 'Maintenance', biomedical_team: 'Biomedical',
};

export const ROLE_COLORS: Record<HospitalRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  md: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  department_head: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  floor_supervisor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  staff: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  it_team: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  maintenance_team: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  biomedical_team: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

export const ADMIN_ROLES: HospitalRole[] = ['super_admin', 'md', 'department_head'];

export const FLOORS = [
  'Basement', 'Ground Floor', '1st Floor', '2nd Floor', '3rd Floor',
  '4th Floor', '5th Floor', '6th Floor', '7th Floor', '8th Floor', 'Terrace',
] as const;

export const BED_STATUS_CONFIG: Record<BedStatus, { label: string; color: string; dot: string }> = {
  available:   { label: 'Available',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-400' },
  occupied:    { label: 'Occupied',     color: 'bg-brand-red-100 text-brand-red-700 dark:bg-brand-red-900/30 dark:text-brand-red-400', dot: 'bg-brand-red-400' },
  maintenance: { label: 'Maintenance',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-400' },
  reserved:    { label: 'Reserved',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-400' },
};

export const TICKET_PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; sla: string; border: string }> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       sla: '30 min',  border: 'border-red-300 dark:border-red-700' },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', sla: '90 min',  border: 'border-orange-300 dark:border-orange-700' },
  medium:   { label: 'Medium',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',    sla: '3 hrs',   border: 'border-amber-300 dark:border-amber-700' },
  low:      { label: 'Low',      color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',       sla: '5 hrs',   border: 'border-slate-200 dark:border-slate-700' },
};

export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  assigned:    { label: 'Assigned',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  escalated:   { label: 'Escalated',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  closed:      { label: 'Closed',      color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
  reopened:    { label: 'Reopened',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

export const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, { label: string; step: number; color: string }> = {
  created:    { label: 'Created',    step: 1, color: 'bg-slate-100 text-slate-600' },
  approved:   { label: 'Approved',   step: 2, color: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Processing', step: 3, color: 'bg-amber-100 text-amber-700' },
  delivered:  { label: 'Delivered',  step: 4, color: 'bg-cyan-100 text-cyan-700' },
  completed:  { label: 'Completed',  step: 5, color: 'bg-emerald-100 text-emerald-700' },
  rejected:   { label: 'Rejected',   step: 0, color: 'bg-red-100 text-red-700' },
};

export const DEPT_STATUS_CONFIG: Record<DeptReqStatus, { label: string; color: string }> = {
  requested:  { label: 'Requested',  color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
  approved:   { label: 'Approved',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  processing: { label: 'Processing', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  dispensed:  { label: 'Dispensed',  color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  delivered:  { label: 'Delivered',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  completed:  { label: 'Completed',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected:   { label: 'Rejected',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};
