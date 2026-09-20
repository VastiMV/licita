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
        # A tela de armazenamento é só de administrador (ver
        # `apps/armazenamento/views.py`). Sem esta claim, o menu teria que
        # mostrar o item a todo mundo e deixar o 403 explicar — a permissão
        # continua sendo do backend, isto é só para não oferecer o que a
        # pessoa não pode usar.
        token["is_staff"] = user.is_staff
        return token
