# Chama Savings Group — Product Spec

## Users
- **Members**: people who save together in one chama. Each member has a name, phone number, and payout position in the rotation.
- **Treasurer**: the single person who manages the chama, adds or invites members, and oversees each cycle.

## What is a cycle?
A cycle is one complete round of the chama. Every member is expected to contribute the same fixed amount. At the end of the cycle, the full pot goes to one member. After payout, a new cycle begins and the next member in the rotation receives the pot.

## How a member joins
- **Invite link**: the treasurer generates a link; anyone with the link can join by entering their name and phone number.
- **Admin add**: the treasurer manually adds a member by name and phone number inside the app.

## How a member contributes
When a cycle is active, the member taps "Contribute". The app sends an M-Pesa STK push to their phone. After the member enters their M-Pesa PIN, the system receives a callback and marks the contribution as paid.

## Fines
If a member misses the deadline and their contribution is still unpaid when the cycle ends, the system marks the contribution as overdue and creates a fine row. The fine amount is fixed per chama and is separate from the regular contribution.

## Payout
At the end of each cycle, the accumulated pot is paid out to the member whose turn it is. The treasurer confirms the payout, and the cycle is closed.
