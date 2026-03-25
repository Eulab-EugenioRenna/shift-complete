import { OnboardingState, PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../apps/api/src/common/utils/password.util';
import { USER_PREFERENCE_CATALOG } from '../apps/api/src/modules/users/user-preference-catalog';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe123!';

type SeedUser = {
  email: string;
  fullName: string;
  role: Role;
  competencies?: string[];
  preferredShifts?: string[];
  preferredLocationValues?: string[];
};

type SeedTeam = {
  name: string;
  description: string;
  requiredCompetencies?: string[];
  duties: Array<{ name: string; description: string; requiredCompetencies?: string[] }>;
  leader: SeedUser;
  volunteers: SeedUser[];
};

const teamSeeds: SeedTeam[] = [
  {
    name: 'Logistica eventi',
    description: 'Setup, accoglienza materiali e presidio operativo.',
    requiredCompetencies: ['logistics', 'security'],
    duties: [
      { name: 'Capo squadra', description: 'Coordina il setup e i check finali.', requiredCompetencies: ['logistics', 'security'] },
      { name: 'Runner palco', description: 'Supporta palco, sedie e flussi rapidi.', requiredCompetencies: ['logistics'] },
    ],
    leader: { email: 'leader.logistica@shift.local', fullName: 'Luca Bianchi', role: Role.service_leader, competencies: ['logistics', 'security'], preferredShifts: ['morning'], preferredLocationValues: ['sede_a'] },
    volunteers: [
      { email: 'marta.logistica@shift.local', fullName: 'Marta Rossi', role: Role.volunteer, competencies: ['logistics', 'welcome'], preferredShifts: ['morning'], preferredLocationValues: ['sede_a'] },
      { email: 'simone.logistica@shift.local', fullName: 'Simone Gallo', role: Role.volunteer, competencies: ['logistics'], preferredShifts: ['afternoon'], preferredLocationValues: ['sede_b'] },
      { email: 'elisa.logistica@shift.local', fullName: 'Elisa Conti', role: Role.volunteer, competencies: ['logistics', 'security'], preferredShifts: ['evening'], preferredLocationValues: ['sede_a'] },
    ],
  },
  {
    name: 'Supporto sanitario',
    description: 'Presidio sanitario, triage e gestione presidi.',
    requiredCompetencies: ['medical'],
    duties: [
      { name: 'Referente sanitario', description: 'Coordina il punto medico.', requiredCompetencies: ['medical'] },
      { name: 'Supporto triage', description: 'Accoglienza e filtro persone.', requiredCompetencies: ['medical', 'welcome'] },
    ],
    leader: { email: 'leader.sanita@shift.local', fullName: 'Giulia Ferri', role: Role.service_leader, competencies: ['medical'], preferredShifts: ['morning'], preferredLocationValues: ['sede_a'] },
    volunteers: [
      { email: 'davide.sanita@shift.local', fullName: 'Davide Serra', role: Role.volunteer, competencies: ['medical', 'welcome'], preferredShifts: ['morning'], preferredLocationValues: ['sede_a'] },
      { email: 'chiara.sanita@shift.local', fullName: 'Chiara Neri', role: Role.volunteer, competencies: ['medical'], preferredShifts: ['afternoon'], preferredLocationValues: ['sede_b'] },
      { email: 'paolo.sanita@shift.local', fullName: 'Paolo Villa', role: Role.volunteer, competencies: ['medical', 'logistics'], preferredShifts: ['evening'], preferredLocationValues: ['sede_a'] },
    ],
  },
  {
    name: 'Accoglienza',
    description: 'Front desk, accessi, info point e flussi ospiti.',
    requiredCompetencies: ['welcome'],
    duties: [
      { name: 'Desk ingresso', description: 'Gestisce accessi e accrediti.', requiredCompetencies: ['welcome', 'security'] },
      { name: 'Info point', description: 'Supporta ospiti e orientamento.', requiredCompetencies: ['welcome'] },
    ],
    leader: { email: 'leader.accoglienza@shift.local', fullName: 'Sara Moretti', role: Role.service_leader, competencies: ['welcome', 'security'], preferredShifts: ['afternoon'], preferredLocationValues: ['sede_b'] },
    volunteers: [
      { email: 'anna.accoglienza@shift.local', fullName: 'Anna Greco', role: Role.volunteer, competencies: ['welcome', 'security'], preferredShifts: ['morning'], preferredLocationValues: ['sede_a'] },
      { email: 'marco.accoglienza@shift.local', fullName: 'Marco Fontana', role: Role.volunteer, competencies: ['welcome'], preferredShifts: ['afternoon'], preferredLocationValues: ['sede_b'] },
      { email: 'irene.accoglienza@shift.local', fullName: 'Irene Villa', role: Role.volunteer, competencies: ['welcome'], preferredShifts: ['evening'], preferredLocationValues: ['sede_b'] },
    ],
  },
  {
    name: 'Media e streaming',
    description: 'Regia, audio/video, streaming e contenuti live.',
    requiredCompetencies: ['audio', 'lights'],
    duties: [
      { name: 'Regia streaming', description: 'Supervisiona messa in onda e scaletta.', requiredCompetencies: ['audio', 'lights'] },
      { name: 'Camera mobile', description: 'Gestisce riprese in movimento.', requiredCompetencies: ['audio'] },
    ],
    leader: { email: 'leader.media@shift.local', fullName: 'Andrea Leone', role: Role.service_leader, competencies: ['audio', 'lights'], preferredShifts: ['evening'], preferredLocationValues: ['sede_a'] },
    volunteers: [
      { email: 'federica.media@shift.local', fullName: 'Federica Riva', role: Role.volunteer, competencies: ['audio'], preferredShifts: ['afternoon'], preferredLocationValues: ['sede_a'] },
      { email: 'matteo.media@shift.local', fullName: 'Matteo Costa', role: Role.volunteer, competencies: ['audio', 'lights'], preferredShifts: ['evening'], preferredLocationValues: ['sede_b'] },
      { email: 'silvia.media@shift.local', fullName: 'Silvia Orsi', role: Role.volunteer, competencies: ['lights'], preferredShifts: ['morning'], preferredLocationValues: ['sede_a'] },
    ],
  },
];

async function seedPreferenceCatalog() {
  const items = [
    ...USER_PREFERENCE_CATALOG.shifts.map((item) => ({ ...item, type: 'shift' })),
    ...USER_PREFERENCE_CATALOG.competencies.map((item) => ({ ...item, type: 'competency' })),
    ...USER_PREFERENCE_CATALOG.locations.map((item) => ({ ...item, type: 'location' })),
  ];

  for (const item of items) {
    await (prisma as any).userPreferenceCatalogItem.upsert({
      where: { type_value: { type: item.type, value: item.value } },
      update: {
        label: item.label,
        description: item.description,
        keywords: item.keywords ?? [],
        active: true,
        sortOrder: item.sortOrder,
      },
      create: {
        type: item.type,
        value: item.value,
        label: item.label,
        description: item.description,
        keywords: item.keywords ?? [],
        active: true,
        sortOrder: item.sortOrder,
      },
    });
  }
}

async function seedHolidayCalendar(years: number[]) {
  for (const year of years) {
    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IT`);
      if (!response.ok) {
        throw new Error(`holiday fetch failed for ${year}`);
      }

      const items = await response.json() as Array<{ date: string; localName: string; name: string }>;
      for (const item of items) {
        await (prisma as any).holidayCalendarDay.upsert({
          where: { date: new Date(item.date) },
          update: {
            countryCode: 'IT',
            localName: item.localName,
            name: item.name,
            isPublicHoliday: true,
            source: 'nager',
          },
          create: {
            date: new Date(item.date),
            countryCode: 'IT',
            localName: item.localName,
            name: item.name,
            isPublicHoliday: true,
            source: 'nager',
          },
        });
      }
      continue;
    } catch (error) {
      console.warn(`Holiday sync skipped for ${year}:`, error instanceof Error ? error.message : error);
    }

    const fallbackItems = [
      { date: `${year}-01-01`, localName: 'Capodanno', name: 'New Year\'s Day' },
      { date: `${year}-01-06`, localName: 'Epifania', name: 'Epiphany' },
      { date: `${year}-04-25`, localName: 'Festa della Liberazione', name: 'Liberation Day' },
      { date: `${year}-05-01`, localName: 'Festa dei Lavoratori', name: 'Labour Day' },
      { date: `${year}-06-02`, localName: 'Festa della Repubblica', name: 'Republic Day' },
      { date: `${year}-08-15`, localName: 'Ferragosto', name: 'Assumption Day' },
      { date: `${year}-11-01`, localName: 'Ognissanti', name: 'All Saints\' Day' },
      { date: `${year}-12-08`, localName: 'Immacolata Concezione', name: 'Immaculate Conception' },
      { date: `${year}-12-25`, localName: 'Natale', name: 'Christmas Day' },
      { date: `${year}-12-26`, localName: 'Santo Stefano', name: 'St. Stephen\'s Day' },
    ];

    for (const item of fallbackItems) {
      await (prisma as any).holidayCalendarDay.upsert({
        where: { date: new Date(item.date) },
        update: {
          countryCode: 'IT',
          localName: item.localName,
          name: item.name,
          isPublicHoliday: true,
          source: 'seed-fallback',
        },
        create: {
          date: new Date(item.date),
          countryCode: 'IT',
          localName: item.localName,
          name: item.name,
          isPublicHoliday: true,
          source: 'seed-fallback',
        },
      });
    }
  }
}

async function upsertUser(user: SeedUser) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      fullName: user.fullName,
      role: user.role,
      onboardingState: OnboardingState.FULLY_ONBOARDED,
    },
    create: {
      email: user.email,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
      fullName: user.fullName,
      role: user.role,
      onboardingState: OnboardingState.FULLY_ONBOARDED,
    },
  });
}

async function upsertUserSettings(userId: string, user: SeedUser, teamIds: string[], dutyIds: string[]) {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      preferredShifts: user.preferredShifts ?? [],
      preferredTeamIds: teamIds,
      preferredDutyIds: dutyIds,
      preferredLocationValues: user.preferredLocationValues ?? [],
      competencies: user.competencies ?? [],
      aiAutoSchedule: true,
      aiEnabled: true,
    },
    create: {
      userId,
      preferredShifts: user.preferredShifts ?? [],
      preferredTeamIds: teamIds,
      preferredDutyIds: dutyIds,
      preferredLocationValues: user.preferredLocationValues ?? [],
      competencies: user.competencies ?? [],
      aiAutoSchedule: true,
      aiEnabled: true,
    },
  });
}

function atHour(base: Date, daysOffset: number, hour: number, minute = 0) {
  const value = new Date(base);
  value.setDate(value.getDate() + daysOffset);
  value.setHours(hour, minute, 0, 0);
  return value;
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@shift.local';
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
  const fullName = process.env.ADMIN_NAME ?? 'Amministratore';

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role: Role.administrator,
      onboardingState: OnboardingState.FULLY_ONBOARDED,
      passwordHash: hashPassword(password),
    },
    create: {
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: Role.administrator,
      onboardingState: OnboardingState.FULLY_ONBOARDED,
    },
  });

  await seedPreferenceCatalog();
  await seedHolidayCalendar([new Date().getFullYear(), new Date().getFullYear() + 1]);

  const teams: Array<{ team: any; leader: any; duties: any[]; volunteers: any[] }> = [];

  for (const seed of teamSeeds) {
    const leader = await upsertUser(seed.leader);
    const team = await prisma.team.upsert({
      where: { name: seed.name },
      update: { description: seed.description, leaderId: leader.id, requiredCompetencies: seed.requiredCompetencies ?? [] } as any,
      create: { name: seed.name, description: seed.description, leaderId: leader.id, requiredCompetencies: seed.requiredCompetencies ?? [] } as any,
    } as any);

    await prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId: team.id, userId: leader.id } },
      update: {},
      create: { teamId: team.id, userId: leader.id },
    });

    const duties = [];
    for (const dutySeed of seed.duties) {
      const existingDuty = await prisma.duty.findFirst({
        where: { teamId: team.id, name: dutySeed.name },
      });

      if (existingDuty) {
        duties.push(await prisma.duty.update({
          where: { id: existingDuty.id },
          data: { description: dutySeed.description, requiredCompetencies: dutySeed.requiredCompetencies ?? [] } as any,
        }));
        continue;
      }

      duties.push(await prisma.duty.create({
        data: { teamId: team.id, name: dutySeed.name, description: dutySeed.description, requiredCompetencies: dutySeed.requiredCompetencies ?? [] } as any,
      } as any));
    }

    await upsertUserSettings(leader.id, seed.leader, [team.id], duties.map((duty) => duty.id));
    const leaderMembership = await prisma.teamMembership.findUniqueOrThrow({ where: { teamId_userId: { teamId: team.id, userId: leader.id } } });
    await prisma.teamMembershipDuty.deleteMany({ where: { membershipId: leaderMembership.id } });
    await prisma.teamMembershipDuty.create({
      data: { membershipId: leaderMembership.id, dutyId: duties[0].id },
    });

    const volunteers = [];
    for (const [volunteerIndex, volunteerSeed] of seed.volunteers.entries()) {
      const volunteer = await upsertUser(volunteerSeed);
      await prisma.teamMembership.upsert({
        where: { teamId_userId: { teamId: team.id, userId: volunteer.id } },
        update: {},
        create: { teamId: team.id, userId: volunteer.id },
      });
      await upsertUserSettings(volunteer.id, volunteerSeed, [team.id], duties.map((duty) => duty.id));
      const membership = await prisma.teamMembership.findUniqueOrThrow({ where: { teamId_userId: { teamId: team.id, userId: volunteer.id } } });
      const assignedDutyIds = volunteerIndex === 0
        ? duties.map((duty) => duty.id)
        : [duties[volunteerIndex % duties.length].id];
      await prisma.teamMembershipDuty.deleteMany({ where: { membershipId: membership.id } });
      await prisma.teamMembershipDuty.createMany({
        data: assignedDutyIds.map((dutyId) => ({ membershipId: membership.id, dutyId })),
      });
      volunteers.push(volunteer);
    }

    teams.push({ team, leader, duties, volunteers });
  }

  for (const item of teams) {
    await prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId: item.team.id, userId: admin.id } },
      update: {},
      create: { teamId: item.team.id, userId: admin.id },
    });
  }

  // Create team groups
  const mediaGroup = await prisma.teamGroup.upsert({
    where: { id: 'seed-group-media' },
    update: { name: 'Media', description: 'Regia, streaming e produzione contenuti.' },
    create: { id: 'seed-group-media', name: 'Media', description: 'Regia, streaming e produzione contenuti.', sortOrder: 0 },
  } as any);

  const operazioniGroup = await prisma.teamGroup.upsert({
    where: { id: 'seed-group-operazioni' },
    update: { name: 'Operazioni', description: 'Logistica, accoglienza e presidio operativo.' },
    create: { id: 'seed-group-operazioni', name: 'Operazioni', description: 'Logistica, accoglienza e presidio operativo.', sortOrder: 1 },
  } as any);

  // Assign teams to groups (Media e streaming → Media group, Logistica + Accoglienza → Operazioni group)
  const mediaTeam = teams.find((t) => t.team.name === 'Media e streaming');
  if (mediaTeam) {
    await prisma.team.update({ where: { id: mediaTeam.team.id }, data: { groupId: mediaGroup.id } });
  }
  const logisticaTeam = teams.find((t) => t.team.name === 'Logistica eventi');
  const accoglienzaTeam = teams.find((t) => t.team.name === 'Accoglienza');
  if (logisticaTeam) {
    await prisma.team.update({ where: { id: logisticaTeam.team.id }, data: { groupId: operazioniGroup.id } });
  }
  if (accoglienzaTeam) {
    await prisma.team.update({ where: { id: accoglienzaTeam.team.id }, data: { groupId: operazioniGroup.id } });
  }

  const baseDate = new Date();
  baseDate.setHours(9, 0, 0, 0);

  const sundayService = await prisma.event.upsert({
    where: { id: 'seed-sunday-service' },
    update: {
      title: 'Servizio domenicale principale',
      description: 'Serie ricorrente seed con copertura multi-team.',
      type: 'recurring',
      locationValue: 'sede_a',
      startsAt: atHour(baseDate, 4, 10, 0),
      endsAt: atHour(baseDate, 4, 12, 30),
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
      recurrenceTz: 'Europe/Rome',
      recurrenceDurationMonths: 12,
      recurrenceAutoRenew: true,
      recurrenceRenewMonths: 12,
      recurrenceUntil: atHour(baseDate, 369, 12, 30),
    } as any,
    create: {
      id: 'seed-sunday-service',
      title: 'Servizio domenicale principale',
      description: 'Serie ricorrente seed con copertura multi-team.',
      type: 'recurring',
      locationValue: 'sede_a',
      startsAt: atHour(baseDate, 4, 10, 0),
      endsAt: atHour(baseDate, 4, 12, 30),
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
      recurrenceTz: 'Europe/Rome',
      recurrenceDurationMonths: 12,
      recurrenceAutoRenew: true,
      recurrenceRenewMonths: 12,
      recurrenceUntil: atHour(baseDate, 369, 12, 30),
      createdById: admin.id,
    } as any,
  } as any);

  const briefing = await prisma.event.upsert({
    where: { id: 'seed-briefing-logistico' },
    update: {
      title: 'Briefing logistico del venerdi',
      description: 'Allineamento operativo per leader e capi turno.',
      type: 'recurring',
      locationValue: 'sede_b',
      startsAt: atHour(baseDate, 2, 19, 0),
      endsAt: atHour(baseDate, 2, 20, 0),
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=FR',
      recurrenceTz: 'Europe/Rome',
      recurrenceDurationMonths: 6,
      recurrenceAutoRenew: true,
      recurrenceRenewMonths: 6,
      recurrenceUntil: atHour(baseDate, 183, 20, 0),
    } as any,
    create: {
      id: 'seed-briefing-logistico',
      title: 'Briefing logistico del venerdi',
      description: 'Allineamento operativo per leader e capi turno.',
      type: 'recurring',
      locationValue: 'sede_b',
      startsAt: atHour(baseDate, 2, 19, 0),
      endsAt: atHour(baseDate, 2, 20, 0),
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=FR',
      recurrenceTz: 'Europe/Rome',
      recurrenceDurationMonths: 6,
      recurrenceAutoRenew: true,
      recurrenceRenewMonths: 6,
      recurrenceUntil: atHour(baseDate, 183, 20, 0),
      createdById: admin.id,
    } as any,
  } as any);

  const training = await prisma.event.upsert({
    where: { id: 'seed-training-night' },
    update: {
      title: 'Formazione volontari nuovi ingressi',
      description: 'Sessione singola di onboarding operativo.',
      type: 'single',
      locationValue: 'sede_a',
      startsAt: atHour(baseDate, 7, 18, 30),
      endsAt: atHour(baseDate, 7, 21, 0),
    },
    create: {
      id: 'seed-training-night',
      title: 'Formazione volontari nuovi ingressi',
      description: 'Sessione singola di onboarding operativo.',
      type: 'single',
      locationValue: 'sede_a',
      startsAt: atHour(baseDate, 7, 18, 30),
      endsAt: atHour(baseDate, 7, 21, 0),
      createdById: admin.id,
    },
  });

  await prisma.eventSlot.deleteMany({ where: { eventId: { in: [sundayService.id, briefing.id, training.id] } } });

  const seededSlots: any[] = [];
  for (const item of teams) {
    const primaryDuty = item.duties[0];
    const secondaryDuty = item.duties[1];
    seededSlots.push(await prisma.eventSlot.create({
      data: {
        eventId: sundayService.id,
        teamId: item.team.id,
        dutyId: primaryDuty.id,
        startsAt: atHour(baseDate, 4, 9, 15),
        endsAt: atHour(baseDate, 4, 12, 30),
        required: true,
      },
    }));
    seededSlots.push(await prisma.eventSlot.create({
      data: {
        eventId: briefing.id,
        teamId: item.team.id,
        dutyId: secondaryDuty.id,
        startsAt: atHour(baseDate, 2, 19, 0),
        endsAt: atHour(baseDate, 2, 20, 0),
        required: true,
      },
    }));
  }

  const trainingSlots = [
    await prisma.eventSlot.create({
      data: {
        eventId: training.id,
        teamId: teams[0].team.id,
        dutyId: teams[0].duties[0].id,
        startsAt: atHour(baseDate, 7, 18, 30),
        endsAt: atHour(baseDate, 7, 20, 0),
        required: true,
      },
    }),
    await prisma.eventSlot.create({
      data: {
        eventId: training.id,
        teamId: teams[2].team.id,
        dutyId: teams[2].duties[1].id,
        startsAt: atHour(baseDate, 7, 19, 0),
        endsAt: atHour(baseDate, 7, 21, 0),
        required: true,
      },
    }),
  ];

  await prisma.assignment.deleteMany({ where: { slotId: { in: [...seededSlots, ...trainingSlots].map((slot) => slot.id) } } });

  for (const [index, slot] of seededSlots.entries()) {
    const teamSeed = teams[index % teams.length];
    const assignee = index % 2 === 0 ? teamSeed.volunteers[0] : teamSeed.leader;
    await prisma.assignment.create({
      data: {
        slotId: slot.id,
        assigneeId: assignee.id,
        status: 'assigned',
        autoAssigned: index % 3 === 0,
      },
    });
  }

  await prisma.assignment.create({
    data: {
      slotId: trainingSlots[0].id,
      assigneeId: teams[0].volunteers[1].id,
      status: 'confirmed',
      autoAssigned: false,
    },
  });

  await prisma.assignment.create({
    data: {
      slotId: trainingSlots[1].id,
      assigneeId: teams[2].volunteers[0].id,
      status: 'assigned',
      autoAssigned: false,
    },
  });

  for (const [index, item] of teams.entries()) {
    const volunteer = item.volunteers[2];
    await prisma.availability.upsert({
      where: { id: `seed-unavailable-${index}` },
      update: {
        userId: volunteer.id,
        teamId: item.team.id,
        type: 'UNAVAILABLE',
        startsAt: atHour(baseDate, 5 + index, 8, 0),
        endsAt: atHour(baseDate, 5 + index, 14, 0),
        reason: 'Impegno personale seed',
      },
      create: {
        id: `seed-unavailable-${index}`,
        userId: volunteer.id,
        teamId: item.team.id,
        type: 'UNAVAILABLE',
        startsAt: atHour(baseDate, 5 + index, 8, 0),
        endsAt: atHour(baseDate, 5 + index, 14, 0),
        reason: 'Impegno personale seed',
      },
    } as any);
  }

  const inventoryExists = await prisma.inventoryItem.findFirst({ where: { serialNumber: 'RAD-001' } });
  if (!inventoryExists) {
    await prisma.inventoryItem.createMany({
      data: [
        { teamId: teams[0].team.id, name: 'Radio portatile', serialNumber: 'RAD-001', status: 'available' },
        { teamId: teams[1].team.id, name: 'Kit primo soccorso', serialNumber: 'MED-004', status: 'checked_out', maintenanceDueAt: new Date(Date.now() - 86400000) },
        { teamId: teams[3].team.id, name: 'Camera PTZ', serialNumber: 'MED-STREAM-01', status: 'available' },
      ],
    });
  }

  const existingResource = await prisma.resourceFile.findFirst({ where: { path: '/seed/procedura-sicurezza.pdf' } });
  if (!existingResource) {
    await prisma.resourceFile.createMany({
      data: [
        { name: 'Procedura sicurezza.pdf', path: '/seed/procedura-sicurezza.pdf', mimeType: 'application/pdf', sizeBytes: 182430 },
        { name: 'Briefing logistica aprile.docx', path: '/seed/briefing-logistica-aprile.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 90213, teamId: teams[0].team.id },
        { name: 'Scaletta regia domenica.xlsx', path: '/seed/scaletta-regia-domenica.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 44213, teamId: teams[3].team.id },
      ],
    });
  }

  const adminNotification = await prisma.notification.findFirst({ where: { userId: admin.id, subject: 'Turno confermato' } });
  if (!adminNotification) {
    await prisma.notification.createMany({
      data: [
        { userId: admin.id, channel: 'in_app', subject: 'Turno confermato', body: 'Il turno del servizio domenicale e stato confermato.' },
        { userId: teams[0].leader.id, channel: 'in_app', subject: 'Nuova serie ricorrente', body: 'La serie domenicale e stata estesa di default per 12 mesi.' },
        { userId: teams[2].volunteers[0].id, channel: 'in_app', subject: 'Assegnazione ricevuta', body: 'Sei stato assegnato al turno di formazione volontari.' },
      ],
    });
  }

  console.log(`Seed completato. Admin: ${email}. Password di default: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
