/**
 * Chit Fund Data Models
 * 
 * These interfaces define the expected data structures for the Chit Fund module.
 * These should be used as TypeScript interfaces or JSDoc type hints.
 * 
 * Expected MongoDB Collections:
 * - Chits
 * - ChitMembers
 * - ChitPayments
 * - ChitAuctions
 * - ChitWinners
 * - ChitDividends
 */

/**
 * @typedef {Object} Chit
 * @property {string} _id - Unique identifier
 * @property {string} name - Chit fund name
 * @property {string} description - Description
 * @property {number} monthlyAmount - Monthly installment amount
 * @property {number} duration - Duration in months
 * @property {number} totalMembers - Total number of members
 * @property {number} availableSlots - Available slots to join
 * @property {number} totalPot - Total prize money (monthlyAmount * duration)
 * @property {Date} startDate - Start date
 * @property {Date} endDate - End date
 * @property {string} status - 'active', 'upcoming', 'completed', 'closed'
 * @property {number} processingFee - Processing fee percentage
 * @property {string[]} rules - Array of rule IDs or descriptions
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Update timestamp
 */

/**
 * @typedef {Object} ChitMember
 * @property {string} _id - Unique identifier
 * @property {string} chitId - Reference to Chit
 * @property {string} userId - Reference to User
 * @property {string} username - Member username
 * @property {string} memberNumber - Member number in the chit (1 to totalMembers)
 * @property {string} status - 'active', 'inactive', 'cancelled', 'completed'
 * @property {number} totalPaid - Total amount paid
 * @property {number} remainingAmount - Remaining amount to pay
 * @property {number} currentMonth - Current month number
 * @property {boolean} hasWon - Whether member has won the auction
 * @property {Date} joinedAt - Join date
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Update timestamp
 */

/**
 * @typedef {Object} ChitPayment
 * @property {string} _id - Unique identifier
 * @property {string} chitId - Reference to Chit
 * @property {string} userId - Reference to User
 * @property {string} memberId - Reference to ChitMember
 * @property {number} month - Month number (1 to duration)
 * @property {number} amount - Amount paid
 * @property {number} lateFee - Late fee if any
 * @property {string} status - 'paid', 'pending', 'failed', 'refunded'
 * @property {Date} dueDate - Due date
 * @property {Date} paidDate - Actual payment date
 * @property {string} transactionId - Transaction ID
 * @property {string} receiptId - Receipt ID
 * @property {string} paymentMethod - Payment method used
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Update timestamp
 */

/**
 * @typedef {Object} ChitAuction
 * @property {string} _id - Unique identifier
 * @property {string} chitId - Reference to Chit
 * @property {number} month - Month number
 * @property {Date} auctionDate - Auction date
 * @property {string} status - 'upcoming', 'active', 'completed', 'cancelled'
 * @property {string} winnerId - Reference to ChitMember (winner)
 * @property {number} winningAmount - Amount at which chit was won
 * @property {number} discount - Discount amount (totalPot - winningAmount)
 * @property {number} dividendPerMember - Dividend per non-winning member
 * @property {Array} bids - Array of bids placed
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Update timestamp
 */

/**
 * @typedef {Object} ChitBid
 * @property {string} _id - Unique identifier
 * @property {string} auctionId - Reference to ChitAuction
 * @property {string} memberId - Reference to ChitMember
 * @property {number} amount - Bid amount
 * @property {Date} bidTime - Bid timestamp
 */

/**
 * @typedef {Object} ChitWinner
 * @property {string} _id - Unique identifier
 * @property {string} chitId - Reference to Chit
 * @property {string} auctionId - Reference to ChitAuction
 * @property {string} memberId - Reference to ChitMember
 * @property {string} username - Winner username
 * @property {number} month - Winning month
 * @property {number} winningAmount - Amount won
 * @property {number} discount - Discount received
 * @property {Date} wonAt - Winning date
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} ChitDividend
 * @property {string} _id - Unique identifier
 * @property {string} chitId - Reference to Chit
 * @property {string} auctionId - Reference to ChitAuction
 * @property {string} memberId - Reference to ChitMember
 * @property {number} month - Month number
 * @property {number} amount - Dividend amount
 * @property {string} status - 'pending', 'credited', 'failed'
 * @property {Date} creditedAt - Credit date
 * @property {string} transactionId - Transaction ID
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Update timestamp
 */

/**
 * @typedef {Object} ChitDashboard
 * @property {number} activeChits - Number of active chits
 * @property {number} myJoinedChits - Number of joined chits
 * @property {number} totalPaid - Total amount paid across all chits
 * @property {number} upcomingDue - Next due amount
 * @property {Date} nextDueDate - Next due date
 * @property {string} auctionStatus - Auction status
 * @property {Date} nextAuctionDate - Next auction date
 * @property {string} winningStatus - Winning status
 * @property {number} totalDividend - Total dividend received
 * @property {number} availableChits - Number of available chits to join
 */

/**
 * @typedef {Object} Receipt
 * @property {string} _id - Unique identifier
 * @property {string} receiptId - Receipt ID
 * @property {string} chitId - Reference to Chit
 * @property {string} paymentId - Reference to ChitPayment
 * @property {string} userId - Reference to User
 * @property {number} amount - Amount
 * @property {number} lateFee - Late fee
 * @property {number} total - Total amount
 * @property {Date} paymentDate - Payment date
 * @property {string} month - Month description
 * @property {string} status - 'paid', 'failed'
 * @property {string} transactionId - Transaction ID
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} SupportTicket
 * @property {string} _id - Unique identifier
 * @property {string} userId - Reference to User
 * @property {string} chitId - Reference to Chit (optional)
 * @property {string} subject - Subject
 * @property {string} description - Description
 * @property {string} status - 'open', 'in_progress', 'resolved', 'closed'
 * @property {string} priority - 'low', 'medium', 'high', 'urgent'
 * @property {Array} messages - Conversation messages
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Update timestamp
 */

// Export for use in components
export const ChitStatus = {
  ACTIVE: 'active',
  UPCOMING: 'upcoming',
  COMPLETED: 'completed',
  CLOSED: 'closed',
};

export const MemberStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const PaymentStatus = {
  PAID: 'paid',
  PENDING: 'pending',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

export const AuctionStatus = {
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const DividendStatus = {
  PENDING: 'pending',
  CREDITED: 'credited',
  FAILED: 'failed',
};
