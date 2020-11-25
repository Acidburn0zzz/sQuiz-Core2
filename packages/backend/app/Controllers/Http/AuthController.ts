import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import { ProviderEnum } from '@squiz/shared';
import AuthenticationException from 'App/Exceptions/AuthenticationException';
import User from 'App/Models/User';
import Twitch from 'App/Utils/oAuth/Twitch';
import LoginValidator from 'App/Validators/LoginValidator';
import OAuthValidator from 'App/Validators/OAuthValidator';
import PasswordValidator from 'App/Validators/PasswordValidator';

export default class AuthController {
  public async login({ request, auth }: HttpContextContract) {
    const { email, password } = await request.validate(LoginValidator);
    try {
      const token = await auth.attempt(email, password);
      return { email, token: token.token };
    } catch (e) {
      throw new AuthenticationException('Mot de passe invalide');
    }
  }

  public async password({ request, auth }: HttpContextContract) {
    const { password } = await request.validate(PasswordValidator);
    const user = auth.user;
    user?.merge({ password });
    return user?.save();
  }

  public async oauth({ request, auth }: HttpContextContract) {
    const { code } = await request.validate(OAuthValidator);
    const twitch = new Twitch();
    // Retrieve user's twitch access token
    const oAuthData = await twitch.login(code);
    // Create a new user or get the user if already exist
    const user = await User.firstOrCreate({
      email: oAuthData.email,
      username: oAuthData.username,
    });
    // Store user's oauth credentials
    await user.related('oAuthToken').updateOrCreate(
      { providerId: ProviderEnum.Twitch },
      {
        token: oAuthData.token,
        refreshToken: oAuthData.refreshToken,
        providerUserId: oAuthData.userId,
      },
    );
    // Generate a token
    const userToken = await auth.login(user);
    return { username: oAuthData.username, token: userToken.token };
  }
}
