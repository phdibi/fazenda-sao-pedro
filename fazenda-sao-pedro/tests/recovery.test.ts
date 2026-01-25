import { describe, it, expect, vi } from 'vitest';
import { recoverLostBirthDates } from '../services/recoveryService';
import { Animal, WeighingType, AnimalStatus, Sexo, Raca } from '../types';

import { beforeEach } from 'vitest';

describe('Recovery Service', () => {
  const mockUpdateAnimal = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseAnimal: Animal = {
    id: '1',
    brinco: '123',
    raca: Raca.Braford,
    sexo: Sexo.Macho,
    pesoKg: 300,
    status: AnimalStatus.Ativo,
    fotos: [],
    historicoSanitario: [],
    historicoPesagens: [],
  };

  it('should recover date from Birth weight', async () => {
    const birthDate = new Date('2023-01-01T00:00:00.000Z');
    const animals: Animal[] = [
      {
        ...baseAnimal,
        dataNascimento: undefined, // MISSING
        historicoPesagens: [
          {
            id: 'w1',
            date: birthDate,
            weightKg: 30,
            type: WeighingType.Birth,
          }
        ]
      }
    ];

    const stats = await recoverLostBirthDates(animals, mockUpdateAnimal);

    expect(stats.recovered).toBe(1);
    expect(mockUpdateAnimal).toHaveBeenCalledWith('1', {
      dataNascimento: birthDate
    });
  });

  it('should skip suspicious dates (older record exists)', async () => {
    const suspiciousDate = new Date('2024-05-21'); // New (buggy) date
    const oldWeightDate = new Date('2023-12-01'); // Old record

    const animals: Animal[] = [
      {
        ...baseAnimal,
        dataNascimento: undefined,
        historicoPesagens: [
          {
            id: 'w_old',
            date: oldWeightDate,
            weightKg: 200,
            type: WeighingType.None,
          },
          {
            id: 'w_buggy',
            date: suspiciousDate,
            weightKg: 30,
            type: WeighingType.Birth, // User added this recently with wrong date
          }
        ]
      }
    ];

    const stats = await recoverLostBirthDates(animals, mockUpdateAnimal);

    expect(stats.recovered).toBe(0);
    expect(stats.skippedSuspicious).toBe(1);
    expect(mockUpdateAnimal).not.toHaveBeenCalled();
  });

  it('should ignore animals that already have birth date', async () => {
    const animals: Animal[] = [
      {
        ...baseAnimal,
        dataNascimento: new Date('2023-01-01'), // HAS DATE
        historicoPesagens: [
          {
            id: 'w1',
            date: new Date('2023-01-01'),
            weightKg: 30,
            type: WeighingType.Birth,
          }
        ]
      }
    ];

    const stats = await recoverLostBirthDates(animals, mockUpdateAnimal);

    expect(stats.foundMissing).toBe(0);
    expect(mockUpdateAnimal).not.toHaveBeenCalled();
  });

  it('should recover date when existing date is Invalid Date', async () => {
    const birthDate = new Date('2023-01-01T00:00:00.000Z');
    const animals: Animal[] = [
      {
        ...baseAnimal,
        dataNascimento: new Date('invalid'), // INVALID DATE
        historicoPesagens: [
          {
            id: 'w1',
            date: birthDate,
            weightKg: 30,
            type: WeighingType.Birth,
          }
        ]
      }
    ];

    const stats = await recoverLostBirthDates(animals, mockUpdateAnimal);

    expect(stats.recovered).toBe(1);
    expect(mockUpdateAnimal).toHaveBeenCalledWith('1', {
      dataNascimento: birthDate
    });
  });
});
