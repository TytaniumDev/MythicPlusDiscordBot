import { describe, it, expect } from 'vitest';
import { ROLE_TANK, ROLE_HEALER, ROLE_TANK_OFFSPEC, ROLE_HEALER_OFFSPEC } from '@mythicplus/shared';
import {
  createMainSpecView,
  createOffspecView,
  createUtilitiesView,
  handleRoleButtonClick,
  handleNoneButtonClick,
  handleNextButtonClick,
  type RoleSelectionState,
  type RoleButtonData,
  type NoneButtonData,
  type NextButtonData,
} from '../src/core/roleUi.js';

function makeState(selectedRoles: string[] = []): RoleSelectionState {
  return {
    playerName: 'TestPlayer',
    discordId: '12345',
    selectedRoles: new Set(selectedRoles),
    views: [],
    stepContents: [],
  };
}

describe('MainSpecView', () => {
  it('initializes with pre-selected roles', () => {
    const state = makeState([ROLE_TANK, 'Brez']);
    const view = createMainSpecView(state, 'test');

    const tankBtn = view.buttons.find(
      (b) => 'roleName' in b && b.roleName === ROLE_TANK,
    ) as RoleButtonData;
    expect(tankBtn.style).toBe('primary');

    const healerBtn = view.buttons.find(
      (b) => 'roleName' in b && b.roleName === ROLE_HEALER,
    ) as RoleButtonData;
    expect(healerBtn.style).toBe('secondary');
  });
});

describe('handleRoleButtonClick', () => {
  it('toggles role on and off', () => {
    const state = makeState();
    const view = createMainSpecView(state, 'test');

    // Click tank on
    handleRoleButtonClick(state, view.buttons, ROLE_TANK, true);
    expect(state.selectedRoles.has(ROLE_TANK)).toBe(true);
    const tankBtn = view.buttons.find(
      (b) => 'roleName' in b && b.roleName === ROLE_TANK,
    ) as RoleButtonData;
    expect(tankBtn.style).toBe('primary');

    // Click tank off
    handleRoleButtonClick(state, view.buttons, ROLE_TANK, true);
    expect(state.selectedRoles.has(ROLE_TANK)).toBe(false);
    expect(tankBtn.style).toBe('secondary');
  });

  it('enforces main spec mutual exclusivity', () => {
    const state = makeState();
    const view = createMainSpecView(state, 'test');

    handleRoleButtonClick(state, view.buttons, ROLE_TANK, true);
    expect(state.selectedRoles.has(ROLE_TANK)).toBe(true);

    // Selecting healer should deselect tank
    handleRoleButtonClick(state, view.buttons, ROLE_HEALER, true);
    expect(state.selectedRoles.has(ROLE_HEALER)).toBe(true);
    expect(state.selectedRoles.has(ROLE_TANK)).toBe(false);

    const tankBtn = view.buttons.find(
      (b) => 'roleName' in b && b.roleName === ROLE_TANK,
    ) as RoleButtonData;
    expect(tankBtn.style).toBe('secondary');
  });
});

describe('shared state across views', () => {
  it('modifying one view affects the other via shared state', () => {
    const state = makeState();
    const mainView = createMainSpecView(state, 'test_main');
    const offspecView = createOffspecView(state, 'test_off');

    handleRoleButtonClick(state, mainView.buttons, ROLE_TANK, true);
    handleRoleButtonClick(state, offspecView.buttons, ROLE_HEALER_OFFSPEC, false);

    expect(state.selectedRoles.has(ROLE_TANK)).toBe(true);
    expect(state.selectedRoles.has(ROLE_HEALER_OFFSPEC)).toBe(true);
  });
});

describe('NextButton', () => {
  it('advances to next view', () => {
    const state = makeState();
    const mainView = createMainSpecView(state, 'test_main');
    const offspecView = createOffspecView(state, 'test_off');
    const utilitiesView = createUtilitiesView(state, 'test_util');
    state.views = [mainView, offspecView, utilitiesView];
    state.stepContents = [
      'Select your roles for **TestPlayer**:\n**Main Spec** (pick one)',
      '**Offspec** (pick any)',
      '**Utilities**',
    ];

    const result = handleNextButtonClick(state, mainView.buttons);

    expect(result).not.toBeNull();
    expect(result!.nextView).toBe(offspecView);
    expect(result!.content).toBe('**Offspec** (pick any)');

    // Next button should be disabled
    const nextBtn = mainView.buttons.find(
      (b) => 'disabled' in b && 'label' in b && (b as NextButtonData).label === 'Next →',
    ) as NextButtonData;
    expect(nextBtn.disabled).toBe(true);
  });
});

describe('NoneButton', () => {
  it('starts highlighted when no offspec roles', () => {
    const state = makeState();
    const view = createOffspecView(state, 'test_off');
    const noneBtn = view.buttons.find((b) => 'clearRoles' in b) as NoneButtonData;
    expect(noneBtn.style).toBe('primary');
  });

  it('starts secondary when offspec roles exist', () => {
    const state = makeState([ROLE_TANK_OFFSPEC]);
    const view = createOffspecView(state, 'test_off');
    const noneBtn = view.buttons.find((b) => 'clearRoles' in b) as NoneButtonData;
    expect(noneBtn.style).toBe('secondary');
  });

  it('clears all offspec roles', () => {
    const state = makeState([ROLE_TANK_OFFSPEC, ROLE_HEALER_OFFSPEC]);
    const view = createOffspecView(state, 'test_off');

    const noneBtn = view.buttons.find((b) => 'clearRoles' in b) as NoneButtonData;
    handleNoneButtonClick(state, view.buttons, noneBtn.clearRoles);

    expect(state.selectedRoles.has(ROLE_TANK_OFFSPEC)).toBe(false);
    expect(state.selectedRoles.has(ROLE_HEALER_OFFSPEC)).toBe(false);
    expect(noneBtn.style).toBe('primary');

    // All role buttons reset
    for (const btn of view.buttons) {
      if ('roleName' in btn) {
        expect((btn as RoleButtonData).style).toBe('secondary');
      }
    }
  });

  it('is deselected when a role is clicked', () => {
    const state = makeState();
    const view = createOffspecView(state, 'test_off');
    const noneBtn = view.buttons.find((b) => 'clearRoles' in b) as NoneButtonData;
    expect(noneBtn.style).toBe('primary');

    // Click an offspec role
    handleRoleButtonClick(state, view.buttons, ROLE_TANK_OFFSPEC, false);
    expect(noneBtn.style).toBe('secondary');
    expect(state.selectedRoles.has(ROLE_TANK_OFFSPEC)).toBe(true);
  });
});

describe('UtilitiesView', () => {
  it('creates with correct buttons', () => {
    const state = makeState();
    const view = createUtilitiesView(state, 'test_util');
    expect(view.buttons.length).toBe(2);
    expect(view.type).toBe('utilities');
  });
});
