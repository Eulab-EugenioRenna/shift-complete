import { OnboardingState, PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../apps/api/src/common/utils/password.util';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@shift.local';
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const fullName = process.env.ADMIN_NAME ?? 'Amministratore';

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role: Role.administrator,
      onboardingState: OnboardingState.FULLY_ONBOARDED
    },
    create: {
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: Role.administrator,
      onboardingState: OnboardingState.FULLY_ONBOARDED
    }
  });

  const logisticsTeam = await prisma.team.upsert({
    where: { name: 'Logistica eventi' },
    update: {
      leaderId: admin.id
    },
    create: {
      name: 'Logistica eventi',
      description: 'Gestione setup, materiali e presidio operativo.',
      leaderId: admin.id
    }
  });

  const medicalTeam = await prisma.team.upsert({
    where: { name: 'Supporto sanitario' },
    update: {
      leaderId: admin.id
    },
    create: {
      name: 'Supporto sanitario',
      description: 'Copertura sanitaria e gestione presidi.',
      leaderId: admin.id
    }
  });

  await prisma.teamMembership.upsert({
    where: {
      teamId_userId: {
        teamId: logisticsTeam.id,
        userId: admin.id
      }
    },
    update: {},
    create: {
      teamId: logisticsTeam.id,
      userId: admin.id
    }
  });

  await prisma.teamMembership.upsert({
    where: {
      teamId_userId: {
        teamId: medicalTeam.id,
        userId: admin.id
      }
    },
    update: {},
    create: {
      teamId: medicalTeam.id,
      userId: admin.id
    }
  });

  let event = await prisma.event.findFirst({
    where: {
      title: 'Servizio domenicale principale'
    }
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        title: 'Servizio domenicale principale',
        description: 'Evento seed per dashboard e calendario.',
        type: 'recurring',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
        recurrenceTz: 'Europe/Rome'
      }
    });
  }

  let logisticsDuty = await prisma.duty.findFirst({
    where: {
      teamId: logisticsTeam.id,
      name: 'Capo squadra'
    }
  });

  if (!logisticsDuty) {
    logisticsDuty = await prisma.duty.create({
      data: {
        teamId: logisticsTeam.id,
        name: 'Capo squadra',
        description: 'Coordinamento operativo del team logistico.'
      }
    });
  }

  let logisticsSlot = await prisma.eventSlot.findFirst({
    where: {
      eventId: event.id,
      teamId: logisticsTeam.id,
      dutyId: logisticsDuty.id
    }
  });

  if (!logisticsSlot) {
    logisticsSlot = await prisma.eventSlot.create({
      data: {
        eventId: event.id,
        teamId: logisticsTeam.id,
        dutyId: logisticsDuty.id,
        startsAt: event.startsAt,
        endsAt: event.endsAt
      }
    });
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      slotId: logisticsSlot.id,
      assigneeId: admin.id
    }
  });

  if (!assignment) {
    await prisma.assignment.create({
      data: {
        slotId: logisticsSlot.id,
        assigneeId: admin.id,
        status: 'assigned',
        autoAssigned: false
      }
    });
  }

  const existingInventory = await prisma.inventoryItem.findFirst({
    where: {
      teamId: logisticsTeam.id,
      name: 'Radio portatile'
    }
  });

  if (!existingInventory) {
    await prisma.inventoryItem.createMany({
      data: [
        {
          teamId: logisticsTeam.id,
          name: 'Radio portatile',
          serialNumber: 'RAD-001',
          status: 'available'
        },
        {
          teamId: medicalTeam.id,
          name: 'Kit primo soccorso',
          serialNumber: 'MED-004',
          status: 'checked_out',
          maintenanceDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ]
    });
  }

  const existingResource = await prisma.resourceFile.findFirst({
    where: {
      path: '/seed/procedura-sicurezza.pdf'
    }
  });

  if (!existingResource) {
    await prisma.resourceFile.createMany({
      data: [
        {
          name: 'Procedura sicurezza.pdf',
          path: '/seed/procedura-sicurezza.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 182430
        },
        {
          name: 'Briefing logistica aprile.docx',
          path: '/seed/briefing-logistica-aprile.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 90213,
          teamId: logisticsTeam.id
        }
      ]
    });
  }

  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId: admin.id,
      subject: 'Turno confermato'
    }
  });

  if (!existingNotification) {
    await prisma.notification.createMany({
      data: [
        {
          userId: admin.id,
          channel: 'in_app',
          subject: 'Turno confermato',
          body: 'Il turno del servizio domenicale e stato confermato.'
        },
        {
          userId: admin.id,
          channel: 'in_app',
          subject: 'Strumento da revisionare',
          body: 'Il kit primo soccorso richiede controllo manutentivo.'
        }
      ]
    });
  }

  console.log(`Amministratore seed creato/aggiornato: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
