import { Injectable } from "@nestjs/common";
import { UserRole } from "./types";

@Injectable()
export class PermissionsService {
  // Define permission hierarchy: regular < admin_new < admin_edit < admin < super_admin
  private readonly permissions = {
    regular: {
      fullAccess: false,
      addingAdmins: false,
      accessActiveAMA: false,
      accessWinnerSelection: false,
      editAnnouncements: false,
      createAMA: false,
      broadcastAnnouncements: false,
    },
    admin_new: {
      fullAccess: false,
      addingAdmins: false,
      accessActiveAMA: true, // can start/stop AMAs
      accessWinnerSelection: true, // can select winners
      editAnnouncements: false,
      createAMA: false, // need this to start AMAs
      broadcastAnnouncements: false,
    },
    admin_edit: {
      fullAccess: false,
      addingAdmins: false,
      accessActiveAMA: true, // can start/stop AMAs
      accessWinnerSelection: true, // can select winners
      editAnnouncements: true, // can edit announcements
      createAMA: false,
      broadcastAnnouncements: false,
    },
    admin: {
      fullAccess: false,
      addingAdmins: false,
      accessActiveAMA: true, // can start/stop AMAs
      accessWinnerSelection: true, // can select winners
      editAnnouncements: true, // can edit announcements
      createAMA: true,
      broadcastAnnouncements: true, // can broadcast announcements
    },
    super_admin: {
      fullAccess: true,
      addingAdmins: true, // can grant admin access
      accessActiveAMA: true,
      accessWinnerSelection: true,
      editAnnouncements: true,
      createAMA: true,
      broadcastAnnouncements: true,
    },
  };

  hasFullAccess(role: UserRole): boolean {
    return this.permissions[role]?.fullAccess || false;
  }

  canAddAdmins(role: UserRole): boolean {
    return this.permissions[role]?.addingAdmins || false;
  }

  canAccessActiveAMA(role: UserRole): boolean {
    return this.permissions[role]?.accessActiveAMA || false;
  }

  canAccessWinnerSelection(role: UserRole): boolean {
    return this.permissions[role]?.accessWinnerSelection || false;
  }

  canEditAnnouncements(role: UserRole): boolean {
    return this.permissions[role]?.editAnnouncements || false;
  }

  canCreateAMA(role: UserRole): boolean {
    return this.permissions[role]?.createAMA || false;
  }

  canBroadcastAnnouncements(role: UserRole): boolean {
    return this.permissions[role]?.broadcastAnnouncements || false;
  }

  // Check if user can start/stop AMA (same as accessing active AMA)
  canControlAMA(role: UserRole): boolean {
    return this.canAccessActiveAMA(role);
  }

  // Helper method to check if role is administrative
  isAdministrative(role: UserRole): boolean {
    return role !== 'regular';
  }

  // Helper method to check if role can promote others to specific roles
  canPromoteToRole(promoterRole: UserRole, targetRole: UserRole): boolean {
    // Only super_admin can promote others
    if (!this.canAddAdmins(promoterRole)) {
      return false;
    }

    // super_admin can promote to any role except super_admin
    if (promoterRole === 'super_admin') {
      return targetRole !== 'super_admin';
    }

    return false;
  }
}