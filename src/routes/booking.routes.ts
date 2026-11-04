
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { connectDB } from "../config/db.js";
import { verifyJWT } from "../middleware/verify-jwt.js";

const bookingRouter = Router();

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

/**
 * POST /api/bookings
 * Creates a booking for an authenticated user.
 */
bookingRouter.post(
    "/",
    verifyJWT,
    async (req: Request, res: Response) => {
        try {
            const { studioId, startAt, endAt } = req.body;

            // Validate studio ID.
            if (
                typeof studioId !== "string" ||
                !ObjectId.isValid(studioId)
            ) {
                res.status(400).json({
                    success: false,
                    message: "A valid studio ID is required.",
                });
                return;
            }

            // Validate booking dates.
            if (
                typeof startAt !== "string" ||
                typeof endAt !== "string"
            ) {
                res.status(400).json({
                    success: false,
                    message: "Booking start and end times are required.",
                });
                return;
            }

            const startDate = new Date(startAt);
            const endDate = new Date(endAt);

            if (
                Number.isNaN(startDate.getTime()) ||
                Number.isNaN(endDate.getTime())
            ) {
                res.status(400).json({
                    success: false,
                    message: "Invalid booking date or time.",
                });
                return;
            }

            if (startDate >= endDate) {
                res.status(400).json({
                    success: false,
                    message: "End time must be later than start time.",
                });
                return;
            }

            if (startDate <= new Date()) {
                res.status(400).json({
                    success: false,
                    message: "Past bookings are not allowed.",
                });
                return;
            }

            const db = await connectDB();

            // Verify that the studio exists.
            const studio = await db.collection("studios").findOne({
                _id: new ObjectId(studioId),
            });

            if (!studio) {
                res.status(404).json({
                    success: false,
                    message: "Studio not found.",
                });
                return;
            }

            const hourlyRate = Number(studio.pricePerHour);

            if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
                res.status(400).json({
                    success: false,
                    message: "Studio pricing is unavailable.",
                });
                return;
            }

            // Calculate price on the server.
            const durationHours =
                (endDate.getTime() - startDate.getTime()) /
                (1000 * 60 * 60);

            const totalPrice = hourlyRate * durationHours;

            // Check whether the requested time overlaps
            // an existing pending or confirmed booking.
            const conflictingBooking = await db
                .collection("bookings")
                .findOne({
                    studioId: new ObjectId(studioId),
                    status: { $in: ACTIVE_BOOKING_STATUSES },
                    startAt: { $lt: endDate },
                    endAt: { $gt: startDate },
                });

            if (conflictingBooking) {
                res.status(409).json({
                    success: false,
                    message: "This studio is already booked for the selected time.",
                });
                return;
            }

            const now = new Date();

            const booking = {
                studioId: new ObjectId(studioId),
                userId: req.authUser!.id,
                startAt: startDate,
                endAt: endDate,
                hourlyRate,
                totalPrice: Number(totalPrice.toFixed(2)),
                status: "pending",
                createdAt: now,
                updatedAt: now,
            };

            const result = await db
                .collection("bookings")
                .insertOne(booking);

            res.status(201).json({
                success: true,
                message: "Booking created successfully.",
                data: {
                    _id: result.insertedId,
                    ...booking,
                },
            });
        } catch (error) {
            console.error("Booking creation failed:", error);

            res.status(500).json({
                success: false,
                message: "Failed to create booking.",
            });
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
