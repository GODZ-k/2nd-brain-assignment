import { CallerContext } from '@/types';

export type AccessDecision = {
    allowed: boolean;
    reason: string;
};

export type FieldAccess = {
    allowed: string[];
    denied: string[];
};

export class AccessControlService {
    static canReadTransaction(
        ctx: CallerContext,
        transaction: {
            merchantId: string;
            customerId: string;
        },
    ): AccessDecision {
        if (ctx.role === 'admin') {
            return {
                allowed: true,
                reason: 'Admin has full transaction access.',
            };
        }

        if (ctx.role === 'merchant') {
            if (transaction.merchantId !== ctx.callerId) {
                return {
                    allowed: false,
                    reason: 'Transaction belongs to another merchant.',
                };
            }

            return {
                allowed: true,
                reason: 'Transaction belongs to caller merchant.',
            };
        }

        if (ctx.role === 'customer') {
            if (transaction.customerId !== ctx.callerId) {
                return {
                    allowed: false,
                    reason: 'Transaction belongs to another customer.',
                };
            }

            return {
                allowed: true,
                reason: 'Transaction belongs to caller customer.',
            };
        }

        return {
            allowed: false,
            reason: 'Unknown caller role.',
        };
    }

    /**
     * Customer record-level access.
     */
    static canReadCustomer(
        ctx: CallerContext,
        customerId: string,
        hasTransactionWithMerchant = false,
    ): AccessDecision {
        if (ctx.role === 'admin') {
            return {
                allowed: true,
                reason: 'Admin has full customer access.',
            };
        }

        if (ctx.role === 'customer') {
            if (ctx.callerId !== customerId) {
                return {
                    allowed: false,
                    reason: 'Customer can only access their own profile.',
                };
            }

            return {
                allowed: true,
                reason: 'Customer is accessing their own profile.',
            };
        }

        if (ctx.role === 'merchant') {
            if (!hasTransactionWithMerchant) {
                return {
                    allowed: false,
                    reason:
                        'Customer has not transacted with caller merchant.',
                };
            }

            return {
                allowed: true,
                reason:
                    'Customer has transacted with caller merchant.',
            };
        }

        return {
            allowed: false,
            reason: 'Unknown caller role.',
        };
    }

    /**
     * Merchant record-level access.
     */
    static canReadMerchant(
        ctx: CallerContext,
        merchantId: string,
    ): AccessDecision {
        if (ctx.role === 'admin') {
            return {
                allowed: true,
                reason: 'Admin has full merchant access.',
            };
        }

        // Merchants can see their own full profile.
        if (ctx.role === 'merchant') {
            if (ctx.callerId === merchantId) {
                return {
                    allowed: true,
                    reason: 'Merchant is accessing its own profile.',
                };
            }

            // Other merchants can only see public information.
            return {
                allowed: true,
                reason:
                    'Merchant can access public information of another merchant.',
            };
        }

        // Customers can see public merchant information.
        if (ctx.role === 'customer') {
            return {
                allowed: true,
                reason: 'Customer can access public merchant information.',
            };
        }

        return {
            allowed: false,
            reason: 'Unknown caller role.',
        };
    }


    static transactionFields(
        ctx: CallerContext,
    ): FieldAccess {
        const allFields = [
            'id',
            'customerId',
            'merchantId',
            'amount',
            'currency',
            'status',
            'internalNote',
            'createdAt',
        ];

        if (ctx.role === 'admin') {
            return {
                allowed: allFields,
                denied: [],
            };
        }

        const allowed = [
            'id',
            'customerId',
            'merchantId',
            'amount',
            'currency',
            'status',
            'createdAt',
        ];

        return {
            allowed,
            denied: ['internalNote'],
        };
    }

    /**
     * Customer field-level authorization.
     */
    static customerFields(
        ctx: CallerContext,
    ): FieldAccess {
        const allFields = [
            'id',
            'name',
            'email',
            'phone',
            'createdAt',
        ];

        if (ctx.role === 'admin') {
            return {
                allowed: allFields,
                denied: [],
            };
        }

        // Merchant/customer don't get phone number.
        return {
            allowed: [
                'id',
                'name',
                'email',
                'createdAt',
            ],
            denied: ['phone'],
        };
    }

    /**
     * Merchant field-level authorization.
     */
    static merchantFields(
        ctx: CallerContext,
        ownMerchant: boolean,
    ): FieldAccess {
        const publicFields = [
            'id',
            'businessName',
            'category',
            'email',
        ];

        if (ctx.role === 'admin') {
            return {
                allowed: [
                    ...publicFields,
                    'createdAt',
                ],
                denied: [],
            };
        }

        if (ctx.role === 'merchant' && ownMerchant) {
            return {
                allowed: [
                    ...publicFields,
                    'createdAt',
                ],
                denied: [],
            };
        }

        return {
            allowed: publicFields,
            denied: ['createdAt'],
        };
    }
}