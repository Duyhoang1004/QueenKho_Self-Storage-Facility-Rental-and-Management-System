const STORAGE_KEY = 'queenkho.rental-policies.frontend-preview.v1';

export const FALLBACK_POLICY_FACILITIES = [
  { id: 1, code: 'TB', name: 'QueenKho Tân Bình', city: 'TP.HCM', district: 'Tân Bình', status: 'ACTIVE' },
  { id: 2, code: 'TD', name: 'QueenKho Thủ Đức', city: 'TP.HCM', district: 'Thủ Đức', status: 'ACTIVE' },
  { id: 3, code: 'CG', name: 'QueenKho Cầu Giấy', city: 'Hà Nội', district: 'Cầu Giấy', status: 'ACTIVE' },
];

const DEFAULT_VALUES = {
  depositMonthMultiplier: 1,
  cancelFeePercent: 20,
  cancelFreeHours: 24,
  lateFeePercentPerDay: 10,
  lateFeeMaxPercent: 50,
  liquidationDays: 30,
};

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function seedPolicy(facility, index) {
  const createdAt = new Date(Date.now() - (index + 2) * 86400000).toISOString();
  return {
    id: `preview-${facility.id}-v1`,
    facilityId: facility.id,
    version: 1,
    ...DEFAULT_VALUES,
    createdAt,
    createdBy: 'Business Operations Manager',
  };
}

export async function getRentalPolicies(facilities = []) {
  const saved = readStore();
  const knownFacilityIds = new Set(saved.map((item) => String(item.facilityId)));
  const seeded = [...saved];

  facilities.forEach((facility, index) => {
    if (!knownFacilityIds.has(String(facility.id))) {
      seeded.push(seedPolicy(facility, index));
    }
  });

  if (seeded.length !== saved.length) writeStore(seeded);
  return seeded;
}

export async function createRentalPolicyVersion(facilityId, values, actorName) {
  const policies = readStore();
  const facilityPolicies = policies.filter((item) => String(item.facilityId) === String(facilityId));
  const nextVersion = facilityPolicies.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;

  const nextPolicy = {
    id: `preview-${facilityId}-v${nextVersion}-${Date.now()}`,
    facilityId,
    version: nextVersion,
    depositMonthMultiplier: Number(values.depositMonthMultiplier),
    cancelFeePercent: Number(values.cancelFeePercent),
    cancelFreeHours: Number(values.cancelFreeHours),
    lateFeePercentPerDay: Number(values.lateFeePercentPerDay),
    lateFeeMaxPercent: Number(values.lateFeeMaxPercent),
    liquidationDays: Number(values.liquidationDays),
    createdAt: new Date().toISOString(),
    createdBy: actorName || 'Business Operations Manager',
  };

  writeStore([...policies, nextPolicy]);
  return nextPolicy;
}

export async function getRentalPolicyHistory(facilityId) {
  return readStore()
    .filter((item) => String(item.facilityId) === String(facilityId))
    .sort((a, b) => Number(b.version) - Number(a.version));
}

export async function restoreRentalPolicyVersion(policy, actorName) {
  return createRentalPolicyVersion(policy.facilityId, policy, actorName);
}

export const rentalPolicyPreviewInfo = {
  isPreview: true,
  storageKey: STORAGE_KEY,
};
