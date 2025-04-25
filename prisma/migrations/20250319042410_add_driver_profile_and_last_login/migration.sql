-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLogin" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "driver_profile" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "vehicleMake" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleYear" TEXT NOT NULL,
    "vehicleColor" TEXT NOT NULL,
    "licenseDocument" TEXT,
    "registrationDocument" TEXT,
    "insuranceDocument" TEXT,
    "backgroundCheckDocument" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_profile_driverId_key" ON "driver_profile"("driverId");

-- AddForeignKey
ALTER TABLE "driver_profile" ADD CONSTRAINT "driver_profile_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
