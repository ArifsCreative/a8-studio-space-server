
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import {
    connectDB,
    getMongoClient,
} from "../config/db.js";
import { verifyJWT } from "../middleware/verify-jwt.js";

class BookingError extends Error {
    constructor(
        message: string,
        public statusCode: number
    ) {
        super(message);
        this.name = "BookingError";
    }
}

const bookingRouter = Router();

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

/**
 * POST /api/bookings
 * Creates a booking for an authenticated user.
 */

/**
 * POST /api/bookings
 * Creates a booking using MongoDB transactions.
 * Serializes competing booking requests for the same studio.
 */
bookingRouter.post(
    "/",
    verifyJWT,
    async (req: Request, res: Response) => {
        const client = getMongoClient();
        const session = client.startSession();

        try {
            const { studioId, startAt, endAt } = req.body;

            if (
                typeof studioId !== "string" ||
                !ObjectId.isValid(studioId)
            ) {
                throw new BookingError("A valid studio ID is required.", 400);
            }

            if (
                typeof startAt !== "string" ||
                typeof endAt !== "string"
            ) {
                throw new BookingError(
                    "Booking start and end times are required.",
                    400
                );
            }

            const startDate = new Date(startAt);
            const endDate = new Date(endAt);

            if (
                Number.isNaN(startDate.getTime()) ||
                Number.isNaN(endDate.getTime())
            ) {
                throw new BookingError("Invalid booking date or time.", 400);
            }

            if (startDate >= endDate) {
                throw new BookingError(
                    "End time must be later than start time.",
                    400
                );
            }

            if (startDate <= new Date()) {
                throw new BookingError(
                    "Past bookings are not allowed.",
                    400
                );
            }

            const db = await connectDB();
            const studioObjectId = new ObjectId(studioId);

            let createdBooking: Record<string, unknown> | null = null;

            await session.withTransaction(async () => {
                // Write to the studio document to serialize
                // competing transactions for the same studio.
                const studioLock = await db.collection("studios").updateOne(
                    { _id: studioObjectId },
                    { $inc: { bookingVersion: 1 } },
                    { session }
                );

                if (studioLock.matchedCount === 0) {
                    throw new BookingError("Studio not found.", 404);
                }

                // Read the current studio pricing inside the transaction.
                const studio = await db.collection("studios").findOne(
                    { _id: studioObjectId },
                    { session }
                );

                if (!studio) {
                    throw new BookingError("Studio not found.", 404);
                }

                const hourlyRate = Number(studio.pricePerHour);

                if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
                    throw new BookingError(
                        "Studio pricing is unavailable.",
                        400
                    );
                }

                // Check overlapping active bookings inside the transaction.
                const conflictingBooking = await db
                    .collection("bookings")
                    .findOne(
                        {
                            studioId: studioObjectId,
                            status: { $in: ["pending", "confirmed"] },
                            startAt: { $lt: endDate },
                            endAt: { $gt: startDate },
                        },
                        { session }
                    );

                if (conflictingBooking) {
                    throw new BookingError(
                        "This studio is already booked for the selected time.",
                        409
                    );
                }

                const durationHours =
                    (endDate.getTime() - startDate.getTime()) /
                    (1000 * 60 * 60);

                const totalPrice = Number(
                    (hourlyRate * durationHours).toFixed(2)
                );

                const now = new Date();

                const booking = {
                    studioId: studioObjectId,
                    userId: req.authUser!.id,
                    startAt: startDate,
                    endAt: endDate,
                    hourlyRate,
                    totalPrice,
                    status: "pending",
                    createdAt: now,
                    updatedAt: now,
                };

                const result = await db
                    .collection("bookings")
                    .insertOne(booking, { session });

                createdBooking = {
                    _id: result.insertedId,
                    ...booking,
                };
            });

            if (!createdBooking) {
                throw new Error("Booking transaction completed without a booking.");
            }

            res.status(201).json({
                success: true,
                message: "Booking created successfully.",
                data: createdBooking,
            });
        } catch (error) {
            if (error instanceof BookingError) {
                res.status(error.statusCode).json({
                    success: false,
                    message: error.message,
                });
                return;
            }

            console.error("Booking transaction failed:", error);

            res.status(500).json({
                success: false,
                message: "Failed to create booking.",
            });
        } finally {
            await session.endSession();
        }
    }
);

/**
 * GET /api/bookings/my
 * Returns bookings belonging to the authenticated user.
 */
bookingRouter.get(
    "/my",
    verifyJWT,
    async (req: Request, res: Response) => {
        try {
            const db = await connectDB();

            const bookings = await db
                .collection("bookings")
                .aggregate([
                    {
                        $match: {
                            userId: req.authUser!.id,
                        },
                    },
                    {
                        $lookup: {
                            from: "studios",
                            localField: "studioId",
                            foreignField: "_id",
                            as: "studio",
                        },
                    },
                    {
                        $unwind: {
                            path: "$studio",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },
                ])
                .toArray();

            res.status(200).json({
                success: true,
                count: bookings.length,
                data: bookings,
            });
        } catch (error) {
            console.error("Failed to fetch user bookings:", error);

            res.status(500).json({
                success: false,
                message: "Failed to fetch your bookings.",
            });
        }
    }
);


/**
 * PATCH /api/bookings/:id/cancel
 * Cancels a pending booking owned by the authenticated user.
 */
bookingRouter.patch(
    "/:id/cancel",
    verifyJWT,
    async (req: Request, res: Response) => {
        try {
            const id = req.params.id;

            if (typeof id !== "string" || !ObjectId.isValid(id)) {
                res.status(400).json({
                    success: false,
                    message: "Invalid booking ID.",
                });
                return;
            }

            const db = await connectDB();

            const result = await db.collection("bookings").updateOne(
                {
                    _id: new ObjectId(id),
                    userId: req.authUser!.id,
                    status: "pending",
                },
                {
                    $set: {
                        status: "cancelled",
                        updatedAt: new Date(),
                    },
                }
            );

            if (result.matchedCount === 0) {
                res.status(404).json({
                    success: false,
                    message:
                        "Booking not found, not owned by you, or cannot be cancelled.",
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: "Booking cancelled successfully.",
                bookingId: id,
                status: "cancelled",
            });
        } catch (error) {
            console.error("Booking cancellation failed:", error);

            res.status(500).json({
                success: false,
                message: "Failed to cancel booking.",
            });
        }
    }
);

export default bookingRouter;
