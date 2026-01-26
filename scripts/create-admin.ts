import { PrismaClient, Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    console.log('🔐 Creating admin account...')

    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD
    const backupEmail = process.env.BACKUP_ADMIN_EMAIL
    const backupPassword = process.env.BACKUP_ADMIN_PASSWORD

    if (!adminEmail || !adminPassword || !backupEmail || !backupPassword) {
      throw new Error('Missing required environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, BACKUP_ADMIN_EMAIL, BACKUP_ADMIN_PASSWORD')
    }

    // Tạo tài khoản admin
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        role: Role.ADMIN,
        password: await hash(adminPassword, 12),
      },
      create: {
        email: adminEmail,
        name: 'Administrator',
        role: Role.ADMIN,
        emailVerified: new Date(),
        password: await hash(adminPassword, 12),
      },
    })

    console.log('✅ Admin account created successfully!')
    console.log(`📧 Email: ${adminEmail}`)
    console.log(`🔑 Password: [HIDDEN]`)
    console.log(`👤 User ID: ${adminUser.id}`)
    
    // Tạo thêm admin backup nếu cần
    const backupAdmin = await prisma.user.upsert({
      where: { email: backupEmail },
      update: {
        role: Role.ADMIN,
      },
      create: {
        email: backupEmail,
        name: 'Backup Admin',
        role: Role.ADMIN,
        emailVerified: new Date(),
        password: await hash(backupPassword, 12),
      },
    })

    console.log('✅ Backup admin account created!')
    console.log(`📧 Backup Email: ${backupEmail}`)
    console.log(`🔑 Backup Password: [HIDDEN]`)

  } catch (error) {
    console.error('❌ Error creating admin:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Chạy script
createAdmin()
  .then(() => {
    console.log('🎉 Admin creation completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Failed to create admin:', error)
    process.exit(1)
  })
