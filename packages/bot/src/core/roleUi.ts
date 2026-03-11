import {
  ROLE_BREZ,
  ROLE_HEALER,
  ROLE_HEALER_OFFSPEC,
  ROLE_LUST,
  ROLE_MELEE,
  ROLE_MELEE_OFFSPEC,
  ROLE_RANGED,
  ROLE_RANGED_OFFSPEC,
  ROLE_TANK,
  ROLE_TANK_OFFSPEC,
} from './config.js';

export type ButtonStyle = 'primary' | 'secondary' | 'success';

export interface RoleButtonData {
  roleName: string;
  label: string;
  style: ButtonStyle;
  customId: string;
  row: number;
  isMainSpec: boolean;
}

export interface NextButtonData {
  label: string;
  style: ButtonStyle;
  customId: string;
  row: number;
  disabled: boolean;
}

export interface NoneButtonData {
  label: string;
  style: ButtonStyle;
  customId: string;
  row: number;
  clearRoles: ReadonlySet<string>;
}

export interface RoleSelectionState {
  playerName: string;
  discordId: string;
  selectedRoles: Set<string>;
  onSaveCallback?: ((interaction: unknown) => Promise<void>) | null;
  views: ViewData[];
  stepContents: string[];
}

export interface ViewData {
  type: 'main' | 'offspec' | 'utilities';
  buttons: (RoleButtonData | NextButtonData | NoneButtonData)[];
  stopped: boolean;
}

// -- Role button callback logic (pure, testable) --

export function handleRoleButtonClick(
  state: RoleSelectionState,
  viewButtons: (RoleButtonData | NextButtonData | NoneButtonData)[],
  roleName: string,
  isMainSpec: boolean,
): void {
  const btn = viewButtons.find(
    (b) => 'roleName' in b && b.roleName === roleName,
  ) as RoleButtonData | undefined;
  if (!btn) return;

  if (state.selectedRoles.has(roleName)) {
    state.selectedRoles.delete(roleName);
    btn.style = 'secondary';
  } else {
    if (isMainSpec) {
      for (const item of viewButtons) {
        if ('roleName' in item && item.roleName !== roleName) {
          state.selectedRoles.delete(item.roleName);
          item.style = 'secondary';
        }
      }
    }
    state.selectedRoles.add(roleName);
    btn.style = 'primary';

    // Deselect NoneButton sibling if present
    for (const item of viewButtons) {
      if ('clearRoles' in item) {
        (item as NoneButtonData).style = 'secondary';
      }
    }
  }
}

export function handleNoneButtonClick(
  state: RoleSelectionState,
  viewButtons: (RoleButtonData | NextButtonData | NoneButtonData)[],
  clearRoles: ReadonlySet<string>,
): void {
  for (const role of clearRoles) {
    state.selectedRoles.delete(role);
  }
  for (const item of viewButtons) {
    if ('roleName' in item) {
      (item as RoleButtonData).style = 'secondary';
    }
  }
  const noneBtn = viewButtons.find((b) => 'clearRoles' in b) as
    | NoneButtonData
    | undefined;
  if (noneBtn) noneBtn.style = 'primary';
}

export function handleNextButtonClick(
  state: RoleSelectionState,
  viewButtons: (RoleButtonData | NextButtonData | NoneButtonData)[],
): { nextView: ViewData; content: string } | null {
  const nextBtn = viewButtons.find(
    (b) => 'disabled' in b && 'label' in b && (b as NextButtonData).label === 'Next →',
  ) as NextButtonData | undefined;
  if (!nextBtn) return null;

  // Find current view index
  const currentView = state.views.find((v) => v.buttons === viewButtons);
  if (!currentView) return null;
  const idx = state.views.indexOf(currentView);
  const nextIdx = idx + 1;
  if (nextIdx >= state.views.length) return null;

  nextBtn.disabled = true;
  return {
    nextView: state.views[nextIdx],
    content: state.stepContents[nextIdx],
  };
}

// -- View creation functions --

const OFFSPEC_ROLES = new Set([
  ROLE_TANK_OFFSPEC,
  ROLE_HEALER_OFFSPEC,
  ROLE_RANGED_OFFSPEC,
  ROLE_MELEE_OFFSPEC,
]);

export function createMainSpecView(
  state: RoleSelectionState,
  prefix: string,
): ViewData {
  const buttons: (RoleButtonData | NextButtonData)[] = [];
  for (const [roleId, label] of [
    [ROLE_TANK, '🛡️ Tank'],
    [ROLE_HEALER, '🌿 Healer'],
    [ROLE_RANGED, '🏹 Ranged'],
    [ROLE_MELEE, '🪓 Melee'],
  ] as const) {
    buttons.push({
      roleName: roleId,
      label,
      style: state.selectedRoles.has(roleId) ? 'primary' : 'secondary',
      customId: `${prefix}:${roleId}`,
      row: 0,
      isMainSpec: true,
    });
  }
  buttons.push({
    label: 'Next →',
    style: 'primary',
    customId: `${prefix}:next`,
    row: 1,
    disabled: false,
  });
  return { type: 'main', buttons, stopped: false };
}

export function createOffspecView(
  state: RoleSelectionState,
  prefix: string,
): ViewData {
  const buttons: (RoleButtonData | NextButtonData | NoneButtonData)[] = [];
  for (const [roleId, label] of [
    [ROLE_TANK_OFFSPEC, '🛡️ Tank'],
    [ROLE_HEALER_OFFSPEC, '🌿 Healer'],
    [ROLE_RANGED_OFFSPEC, '🏹 Ranged'],
    [ROLE_MELEE_OFFSPEC, '🪓 Melee'],
  ] as const) {
    buttons.push({
      roleName: roleId,
      label,
      style: state.selectedRoles.has(roleId) ? 'primary' : 'secondary',
      customId: `${prefix}:${roleId}`,
      row: 0,
      isMainSpec: false,
    });
  }

  const hasOffspec = [...state.selectedRoles].some((r) => OFFSPEC_ROLES.has(r));
  buttons.push({
    label: 'None',
    style: hasOffspec ? 'secondary' : 'primary',
    customId: `${prefix}:none`,
    row: 0,
    clearRoles: OFFSPEC_ROLES,
  });
  buttons.push({
    label: 'Next →',
    style: 'primary',
    customId: `${prefix}:next`,
    row: 1,
    disabled: false,
  });
  return { type: 'offspec', buttons, stopped: false };
}

export function createUtilitiesView(
  state: RoleSelectionState,
  prefix: string,
): ViewData {
  const buttons: RoleButtonData[] = [];
  for (const [roleId, label] of [
    [ROLE_BREZ, '⚰️ Brez'],
    [ROLE_LUST, '🎺 Lust'],
  ] as const) {
    buttons.push({
      roleName: roleId,
      label,
      style: state.selectedRoles.has(roleId) ? 'primary' : 'secondary',
      customId: `${prefix}:${roleId}`,
      row: 0,
      isMainSpec: false,
    });
  }
  return { type: 'utilities', buttons, stopped: false };
}

