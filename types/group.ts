export interface Group {
  id: string;
  name: string;
  password: string; // Hashed in production, plain for now
  members: string[]; // User IDs
  createdAt: Date;
  createdBy: string;
}

export interface GroupSession {
  groupId: string;
  groupName: string;
  userId?: string; // Selected user within the group
}