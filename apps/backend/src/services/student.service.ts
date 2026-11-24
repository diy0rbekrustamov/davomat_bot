import { prisma, Student } from '@davomat/db';
import * as xlsx from 'xlsx';

interface CreateStudentDto {
  groupId: string;
  ismFamiliya: string;
  rasmFileId?: string;
}

export class StudentService {
  async addStudent(data: CreateStudentDto): Promise<Student> {
    const group = await prisma.group.findUnique({ where: { id: data.groupId } });
    if (!group || !group.faolmi) {
      throw new Error('Guruh topilmadi yoki faol emas');
    }

    return prisma.student.create({ data });
  }

  async deleteStudent(id: string) {
    return prisma.student.delete({ where: { id } });
  }

  /**
   * Excel faylni parse qilib o'quvchilarni guruhga qo'shadi.
   * "Ism Familiya" ustuni mavjud bo'lishi kerak.
   */
  async importFromExcel(groupId: string, fileBuffer: Buffer, replace: boolean = false): Promise<{ success: number; errors: string[] }> {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !group.faolmi) {
      throw new Error('Guruh topilmadi yoki faol emas');
    }

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON ga o'girish, 1-qatorni sarlavha (header) sifatida oladi
    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
    
    if (rows.length === 0) {
      throw new Error('Fayl bo`sh');
    }

    // Ustun nomini topamiz ("Ism Familiya", har xil case'larni inobatga olib)
    const headerRow = Object.keys(rows[0]);
    const nameColumn = headerRow.find(h => h.trim().toLowerCase() === 'ism familiya');

    if (!nameColumn) {
      throw new Error('Excel faylda "Ism Familiya" nomli ustun topilmadi');
    }

    const errors: string[] = [];
    const validStudents: string[] = [];

    // Validatsiya
    rows.forEach((row, index) => {
      const ism = row[nameColumn]?.toString().trim();
      const rowNum = index + 2; // Excelda header bilan 1-qator band, ma'lumot 2-qatordan boshlanadi

      if (!ism) {
        errors.push(`${rowNum}-qator: Ism Familiya bo'sh`);
      } else {
        validStudents.push(ism);
      }
    });

    if (errors.length > 0) {
      throw { message: 'Excel validatsiya xatosi', errors };
    }

    await prisma.$transaction(async tx=>{
      if(replace)await tx.student.deleteMany({where:{groupId}});
      await tx.student.createMany({data:validStudents.map(ismFamiliya=>({groupId,ismFamiliya}))});
    });

    return { success: validStudents.length, errors: [] };
  }
}
