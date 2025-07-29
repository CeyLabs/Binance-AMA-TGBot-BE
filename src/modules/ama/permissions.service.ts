import { Injectable } from "@nestjs/common";
import { UserRole } from "./types";

@Injectable()
export class PermissionsService {
  // Define permission hierarchy: regular < host < editor < ama < admin
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
    host: {
      fullAccess: false,
      addingAdmins: false,
      accessActiveAMA: true, // can start/stop AMAs
      accessWinnerSelection: true, // can select winners
      editAnnouncements: false,
      createAMA: false, // need this to start AMAs
      broadcastAnnouncements: false,
    },
    editor: {
      fullAccess: false,
      addingAdmins: false,
      accessActiveAMA: true, // can start/stop AMAs
      accessWinnerSelection: true, // can select winners
      editAnnouncements: true, // can edit announcements
      createAMA: false,
      broadcastAnnouncements: false,
    },
    ama: {
      fullAccess: false,
      addingAdmins: false, // CANNOT manage user permissions
      accessActiveAMA: true, // can start/stop AMAs
      accessWinnerSelection: true, // can select winners
      editAnnouncements: true, // can edit announcements
      createAMA: true, // can create AMAs
      broadcastAnnouncements: true, // can broadcast announcements
    },
    admin: {
      fullAccess: true,
      addingAdmins: true, // can grant admin access
      accessActiveAMA: true, // can start/stop AMAs
      accessWinnerSelection: true, // can select winners
      editAnnouncements: true, // can edit announcements
      createAMA: true,
      broadcastAnnouncements: true, // can broadcast announcements
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

  // Check if user can access the /newama command (either create new or edit existing)
  canAccessNewAMACommand(role: UserRole): boolean {
    return this.canCreateAMA(role) || this.canEditAnnouncements(role);
  }

  // Check if user can start/stop AMA (same as accessing active AMA)
  canControlAMA(role: UserRole): boolean {
    return this.canAccessActiveAMA(role);
  }

  // Helper method to check if role is administrative
  isAdministrative(role: UserRole): boolean {
    return role !== 'regular';
  }

  // Define role hierarchy levels: higher number = higher role
  private readonly roleHierarchy: Record<UserRole, number> = {
    regular: 0,
    host: 1,
    editor: 2,
    ama: 3,
    admin: 4,
  };

  // Get hierarchy level for a role
  getRoleLevel(role: UserRole): number {
    return this.roleHierarchy[role] || 0;
  }

  // Compare two roles: returns 1 if newRole > currentRole (promotion), -1 if newRole < currentRole (demotion), 0 if equal
  compareRoles(currentRole: UserRole | null, newRole: UserRole): number {
    const currentLevel = currentRole ? this.getRoleLevel(currentRole) : 0;
    const newLevel = this.getRoleLevel(newRole);
    
    if (newLevel > currentLevel) return 1; // promotion
    if (newLevel < currentLevel) return -1; // demotion
    return 0; // same level
  }

  // Helper method to check if role can promote others to specific roles
  canPromoteToRole(promoterRole: UserRole): boolean {
    // admin can promote to any role including admin
    if (promoterRole === 'admin') {
      return true;
    }

    return false;
  }
}