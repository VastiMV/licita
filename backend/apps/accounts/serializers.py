from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class LoginSerializer(TokenObtainPairSerializer):
    """
    `TokenObtainPairSerializer` puro só carrega `user_id` no payload do
    `access` — embarcamos `email`/`nome` também, para o menu de perfil do
    Angular (`AuthService.usuario`) exibi-los sem precisar de outro
    endpoint.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["nome"] = user.nome
        return token
