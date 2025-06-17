import type { AuthOptions, Session, User, Account, Profile } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_SECRET_ID!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      // Attach the user's email to the session
      if (session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
    async jwt({ token, account, profile }: { token: JWT; user?: User; account?: Account | null; profile?: Profile; trigger?: string; isNewUser?: boolean; session?: unknown }) {
      if (account && profile) {
        token.email = profile.email as string;
      }
      return token;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST, authOptions }; 
